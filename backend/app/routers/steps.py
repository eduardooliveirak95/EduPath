from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import CurrentUserDep, SessionDep, TodayDep, get_goal_or_404
from app.models import PlanStep, User
from app.progress import record_progress
from app.schemas import PlanStepCreate, PlanStepRead, PlanStepUpdate

router = APIRouter(prefix="/api/goals/{goal_id}/steps", tags=["planos"])


def get_step_or_404(session: Session, goal_id: int, step_id: int, user: User) -> PlanStep:
    # O objetivo tem de ser desta conta, e fica bloqueado até ao fim do pedido.
    get_goal_or_404(session, goal_id, user, lock=True)
    step = session.get(PlanStep, step_id)
    if step is None or step.goal_id != goal_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Passo do plano não encontrado.")
    return step


@router.post("", response_model=PlanStepRead, status_code=status.HTTP_201_CREATED)
def add_step(
    goal_id: int,
    payload: PlanStepCreate,
    session: SessionDep,
    user: CurrentUserDep,
    today: TodayDep,
):
    """Acrescenta um passo no fim do plano."""
    goal = get_goal_or_404(session, goal_id, user, lock=True)
    position = max((step.position for step in goal.plan), default=-1) + 1
    step = PlanStep(title=payload.title, done=payload.done, position=position)
    goal.plan.append(step)
    record_progress(session, goal, today)
    session.commit()
    session.refresh(step)
    return step


@router.patch("/{step_id}", response_model=PlanStepRead)
def update_step(
    goal_id: int,
    step_id: int,
    payload: PlanStepUpdate,
    session: SessionDep,
    user: CurrentUserDep,
    today: TodayDep,
):
    """Muda o texto do passo ou marca-o como feito / por fazer."""
    step = get_step_or_404(session, goal_id, step_id, user)
    for field, value in payload.changes().items():
        setattr(step, field, value)
    record_progress(session, step.goal, today)
    session.commit()
    session.refresh(step)
    return step


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    goal_id: int, step_id: int, session: SessionDep, user: CurrentUserDep, today: TodayDep
):
    step = get_step_or_404(session, goal_id, step_id, user)
    goal = step.goal
    goal.plan.remove(step)  # sai do plano já (e é apagado), para o progresso já não o contar
    record_progress(session, goal, today)
    session.commit()
