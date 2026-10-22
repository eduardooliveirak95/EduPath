"""Objetivos recorrentes: a percentagem passa a contar cada dia feito.

Até aqui era a das semanas cumpridas. A percentagem não fica guardada (é calculada), mas a
evolução do progresso tem de acabar no valor que o objetivo mostra: os recorrentes em que ele
mudou ganham um registo hoje (ou o de hoje é corrigido) com a percentagem nova.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-22 19:05:12.000000
"""

from collections import Counter
from collections.abc import Sequence
from datetime import date, timedelta

import sqlalchemy as sa
from alembic import op

from app.config import get_today

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

goals = sa.table(
    "goals",
    sa.column("id", sa.Integer),
    sa.column("start_date", sa.Date),
    sa.column("target_date", sa.Date),
    sa.column("times_per_week", sa.Integer),
)
checkins = sa.table("goal_checkins", sa.column("goal_id", sa.Integer), sa.column("day", sa.Date))
entries = sa.table(
    "progress_entries",
    sa.column("id", sa.Integer),
    sa.column("goal_id", sa.Integer),
    sa.column("day", sa.Date),
    sa.column("progress", sa.Integer),
)


def days_progress(start: date, target: date, times_per_week: int, days: list[date]) -> int:
    """A percentagem nova, como `weeks_summary` e `current_progress` em app/models.py."""
    first_monday = start - timedelta(days=start.weekday())
    per_week = Counter((day - first_monday).days // 7 for day in days if start <= day <= target)
    done = needed = 0
    for week in range((target - first_monday).days // 7 + 1):
        monday = first_monday + timedelta(weeks=week)
        days_in_goal = (min(monday + timedelta(days=6), target) - max(monday, start)).days + 1
        asked = min(times_per_week, days_in_goal)
        done += min(per_week[week], asked)
        needed += asked
    return (done * 100 + needed // 2) // needed


def upgrade() -> None:
    connection = op.get_bind()
    today = get_today()
    recurring = connection.execute(
        sa.select(goals).where(goals.c.times_per_week.is_not(None))
    ).all()
    for goal_id, start, target, times_per_week in recurring:
        days = connection.scalars(sa.select(checkins.c.day).where(checkins.c.goal_id == goal_id))
        value = days_progress(start, target, times_per_week, list(days))
        latest = connection.execute(
            sa.select(entries.c.id, entries.c.day, entries.c.progress)
            .where(entries.c.goal_id == goal_id)
            .order_by(entries.c.day.desc())
            .limit(1)
        ).first()
        if latest is not None and latest.progress == value:
            continue
        if latest is not None and latest.day >= today:
            op.execute(entries.update().where(entries.c.id == latest.id).values(progress=value))
        else:
            op.execute(entries.insert().values(goal_id=goal_id, day=today, progress=value))


def downgrade() -> None:
    # A evolução fica como está: os registos continuam certos para quando foram feitos.
    pass
