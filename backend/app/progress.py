from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, ProgressEntry


def record_progress(session: Session, goal: Goal, today: date) -> None:
    """Guarda a percentagem que o objetivo mostra hoje, se mudou.

    Chama-se depois de qualquer alteração que a possa mudar (criar o objetivo, editá-lo, ou
    mexer nos passos de um objetivo com o progresso pelos passos). Fica um registo por dia, o
    último desse dia; se no mesmo dia voltar ao valor do registo anterior, o de hoje sai.
    """
    value = goal.current_progress()
    latest = session.scalars(
        select(ProgressEntry)
        .where(ProgressEntry.goal_id == goal.id)
        .order_by(ProgressEntry.day.desc())
        .limit(2)
    ).all()
    if latest and latest[0].day >= today:
        before = latest[1].progress if len(latest) > 1 else None
        if value == before:
            session.delete(latest[0])
        else:
            latest[0].progress = value
    elif not latest or latest[0].progress != value:
        session.add(ProgressEntry(goal_id=goal.id, day=today, progress=value))
