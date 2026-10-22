"""Objetivos recorrentes (goals.times_per_week e goal_checkins).

Os objetivos que já existem ficam como estavam (não recorrentes).

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-22 17:23:39.059722
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goal_checkins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["goals.id"], name="fk_goal_checkins_goal_id_goals", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("goal_id", "day", name="uq_goal_checkins_goal_id_day"),
    )
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.add_column(sa.Column("times_per_week", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "ck_goals_times_per_week_range", "times_per_week BETWEEN 1 AND 7"
        )


def downgrade() -> None:
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.drop_constraint("ck_goals_times_per_week_range", type_="check")
        batch_op.drop_column("times_per_week")

    op.drop_table("goal_checkins")
