"""Esquema inicial: as tabelas criadas antes do Alembic (com create_all).

As BDs que já existiam são marcadas com esta revisão sem a correr (app/migrate.py).

Revision ID: 0001
Revises:
Create Date: 2026-10-16 10:20:06.546136
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "category",
            sa.Enum(
                "saude",
                "carreira",
                "financas",
                "aprendizagem",
                "pessoal",
                name="category",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column(
            "outcome",
            sa.Enum("sucedido", "nao_sucedido", name="outcome", native_enum=False, length=20),
            nullable=True,
        ),
        sa.Column("outcome_note", sa.Text(), nullable=True),
        sa.Column("closed_at", sa.Date(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_goals_progress_range"),
        sa.CheckConstraint("target_date >= start_date", name="ck_goals_dates_order"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "plan_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("plan_steps", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_plan_steps_goal_id"), ["goal_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("plan_steps", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_plan_steps_goal_id"))

    op.drop_table("plan_steps")
    op.drop_table("goals")
