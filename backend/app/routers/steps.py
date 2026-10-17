from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import CurrentUserDep, SessionDep, get_goal_or_404
from app.models import PlanStep, User
from app.schemas import PlanStepCreate, PlanStepRead, PlanStepUpdate

router = APIRouter(prefix="/api/goals/{goal_id}/steps", tags=["planos"])


def get_step_or_404(session: Session, goal_id: int, step_id: int, user: User) -> PlanStep:
    get_goal_or_404(session, goal_id, user)  # o objetivo tem de ser desta conta
    step = session.get(PlanStep, step_id)
    if step is None or step.goal_id != goal_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Passo do plano não encontrado.")
    return step


@router.post("", response_model=PlanStepRead, status_code=status.HTTP_201_CREATED)
def add_step(goal_id: int, payload: PlanStepCreate, session: SessionDep, user: CurrentUserDep):
    """Acrescenta um passo no fim do plano."""
    goal = get_goal_or_404(session, goal_id, user)
    position = max((step.position for step in goal.plan), default=-1) + 1
    step = PlanStep(title=payload.title, done=payload.done, position=position)
    goal.plan.append(step)
    session.commit()
    session.refresh(step)
    return step


@router.patch("/{step_id}", response_model=PlanStepRead)
def update_step(
    goal_id: int, step_id: int, payload: PlanStepUpdate, session: SessionDep, user: CurrentUserDep
):
    """Muda o texto do passo ou marca-o como feito / por fazer."""
    step = get_step_or_404(session, goal_id, step_id, user)
    for field, value in payload.changes().items():
        setattr(step, field, value)
    session.commit()
    session.refresh(step)
    return step


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(goal_id: int, step_id: int, session: SessionDep, user: CurrentUserDep):
    session.delete(get_step_or_404(session, goal_id, step_id, user))
    session.commit()
