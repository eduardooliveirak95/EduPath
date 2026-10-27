from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import ColumnElement, and_, select
from sqlalchemy.orm import Session

from app.deps import CurrentUserDep, SessionDep, TodayDep, get_goal_or_404
from app.models import (
    Category,
    Goal,
    GoalCheckin,
    GoalStatus,
    Outcome,
    PlanStep,
    ProgressEntry,
    User,
)
from app.progress import record_progress
from app.schemas import (
    CLOSED_AT_ERROR,
    DATES_ORDER_ERROR,
    EvaluationCreate,
    GoalCreate,
    GoalRead,
    GoalUpdate,
    PlanStepEdit,
    ProgressPoint,
)

router = APIRouter(prefix="/api/goals", tags=["objetivos"])


def status_filter(goal_status: GoalStatus, today: date) -> ColumnElement[bool]:
    """Condição SQL equivalente a `Goal.status(today) == goal_status`."""
    match goal_status:
        case GoalStatus.EM_CURSO:
            return and_(Goal.outcome.is_(None), Goal.target_date >= today)
        case GoalStatus.POR_AVALIAR:
            return and_(Goal.outcome.is_(None), Goal.target_date < today)
        case _:
            return Goal.outcome == goal_status.value


def set_outcome(goal: Goal, outcome: Outcome | None, today: date) -> None:
    """Avalia o objetivo (a terminar hoje, se ainda não tinha data) ou, com None, reabre-o."""
    if outcome is None:
        goal.outcome_note = None
        goal.closed_at = None
    elif goal.closed_at is None:
        goal.closed_at = today
    goal.outcome = outcome


def replace_plan(goal: Goal, steps: list[PlanStepEdit]) -> None:
    """Põe no plano os passos recebidos, por esta ordem; os que não vierem são apagados."""
    current = {step.id: step for step in goal.plan}
    ids = [step.id for step in steps if step.id is not None]
    if len(ids) != len(set(ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Há passos repetidos no plano.")
    if any(step_id not in current for step_id in ids):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Há passos que não pertencem a este objetivo."
        )

    plan = []
    for position, data in enumerate(steps):
        step = current[data.id] if data.id is not None else PlanStep()
        step.title, step.done, step.position = data.title, data.done, position
        plan.append(step)
    goal.plan = plan  # os passos que ficaram de fora são apagados (delete-orphan)


@router.get("", response_model=list[GoalRead])
def list_goals(
    session: SessionDep,
    user: CurrentUserDep,
    today: TodayDep,
    status: GoalStatus | None = None,
    category: Category | None = None,
):
    """Lista os objetivos por ordem de data limite, com filtros opcionais."""
    query = select(Goal).where(Goal.user_id == user.id).order_by(Goal.target_date, Goal.id)
    if status is not None:
        query = query.where(status_filter(status, today))
    if category is not None:
        query = query.where(Goal.category == category)
    return [GoalRead.from_goal(goal, today) for goal in session.scalars(query)]


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, session: SessionDep, user: CurrentUserDep, today: TodayDep):
    start_date = payload.start_date or today
    if payload.target_date < start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, DATES_ORDER_ERROR)

    goal = Goal(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        start_date=start_date,
        target_date=payload.target_date,
        progress=payload.progress,
        progress_from_steps=payload.progress_from_steps,
        times_per_week=payload.times_per_week,
        plan=[
            PlanStep(title=step.title, done=step.done, position=index)
            for index, step in enumerate(payload.plan)
        ],
    )
    session.add(goal)
    session.flush()  # para o objetivo já ter id
    record_progress(session, goal, today)
    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(goal_id: int, session: SessionDep, user: CurrentUserDep, today: TodayDep):
    return GoalRead.from_goal(get_goal_or_404(session, goal_id, user), today)


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: int, payload: GoalUpdate, session: SessionDep, user: CurrentUserDep, today: TodayDep
):
    """Atualiza só os campos enviados (ex.: a percentagem de progresso)."""
    goal = get_goal_or_404(session, goal_id, user, lock=True)
    changes = payload.changes()
    changes.pop("plan", None)
    if "outcome" in changes:
        set_outcome(goal, changes.pop("outcome"), today)
    if "outcome_note" in changes:
        if goal.outcome is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Só os objetivos já avaliados têm nota do resultado."
            )
        changes["outcome_note"] = changes["outcome_note"] or None
    if "closed_at" in changes and goal.outcome is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Só os objetivos já avaliados têm data em que terminaram."
        )
    for field, value in changes.items():
        setattr(goal, field, value)
    if payload.plan is not None:
        replace_plan(goal, payload.plan)
    if goal.target_date < goal.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, DATES_ORDER_ERROR)
    if ("closed_at" in changes or "start_date" in changes) and not (
        goal.closed_at is None or goal.start_date <= goal.closed_at <= today
    ):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CLOSED_AT_ERROR)
    record_progress(session, goal, today)

    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)


@router.get("/{goal_id}/progress", response_model=list[ProgressPoint])
def progress_history(goal_id: int, session: SessionDep, user: CurrentUserDep):
    """A evolução do progresso: a percentagem de cada dia em que mudou, do mais antigo ao
    mais recente. O último valor é o que o objetivo mostra agora."""
    get_goal_or_404(session, goal_id, user)
    return session.scalars(
        select(ProgressEntry).where(ProgressEntry.goal_id == goal_id).order_by(ProgressEntry.day)
    ).all()


def get_checkin_goal(session: Session, goal_id: int, user: User, day: date, today: date) -> Goal:
    """O objetivo recorrente onde se regista (ou tira) um dia, bloqueado até ao fim do pedido."""
    goal = get_goal_or_404(session, goal_id, user, lock=True)
    if goal.times_per_week is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este objetivo não é recorrente.")
    if goal.outcome is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este objetivo já foi avaliado.")
    if not goal.start_date <= day <= min(goal.target_date, today):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Só dá para registar dias entre o início do objetivo e hoje (até à data limite).",
        )
    return goal


@router.put("/{goal_id}/checkins/{day}", response_model=GoalRead)
def add_checkin(
    goal_id: int, day: date, session: SessionDep, user: CurrentUserDep, today: TodayDep
):
    """Regista que nesse dia se fez o que o objetivo recorrente pede. Se já estava, fica igual."""
    goal = get_checkin_goal(session, goal_id, user, day, today)
    if all(checkin.day != day for checkin in goal.checkins):
        goal.checkins.append(GoalCheckin(day=day))
        record_progress(session, goal, today)
    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)


@router.delete("/{goal_id}/checkins/{day}", response_model=GoalRead)
def remove_checkin(
    goal_id: int, day: date, session: SessionDep, user: CurrentUserDep, today: TodayDep
):
    """Tira o registo desse dia (ex.: marcado por engano). Se não estava, fica igual."""
    goal = get_checkin_goal(session, goal_id, user, day, today)
    goal.checkins = [checkin for checkin in goal.checkins if checkin.day != day]
    record_progress(session, goal, today)
    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, session: SessionDep, user: CurrentUserDep):
    session.delete(get_goal_or_404(session, goal_id, user))
    session.commit()


@router.post("/{goal_id}/evaluation", response_model=GoalRead)
def evaluate_goal(
    goal_id: int,
    payload: EvaluationCreate,
    session: SessionDep,
    user: CurrentUserDep,
    today: TodayDep,
):
    """Regista se o objetivo foi sucedido ou não. Fica no histórico com a data de hoje."""
    goal = get_goal_or_404(session, goal_id, user, lock=True)
    if goal.outcome is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este objetivo já foi avaliado.")

    set_outcome(goal, payload.outcome, today)
    goal.outcome_note = payload.note
    # Num objetivo recorrente avaliado antes da data limite, a percentagem muda (`Goal.weeks`).
    record_progress(session, goal, today)
    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)


@router.delete("/{goal_id}/evaluation", response_model=GoalRead)
def reopen_goal(goal_id: int, session: SessionDep, user: CurrentUserDep, today: TodayDep):
    """Anula a avaliação (ex.: se foi registada por engano)."""
    goal = get_goal_or_404(session, goal_id, user, lock=True)
    set_outcome(goal, None, today)
    record_progress(session, goal, today)
    session.commit()
    session.refresh(goal)
    return GoalRead.from_goal(goal, today)
