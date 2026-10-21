"""Evolução do progresso (progress_entries).

Cada objetivo que já existe fica com um registo: a percentagem que mostra agora, no dia em
que foi avaliado ou, se ainda não foi, no dia da migração. A evolução começa daí.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-21 22:12:38.470771
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# A percentagem que cada objetivo mostra: a escolhida à mão ou, com progress_from_steps, a dos
# passos feitos arredondada a meio para cima (como steps_progress em app/models.py; sem
# passos, 0). Funciona em Postgres e em SQLite.
FIRST_ENTRIES = """
INSERT INTO progress_entries (goal_id, day, progress)
SELECT g.id, COALESCE(g.closed_at, CURRENT_DATE),
    CASE WHEN g.progress_from_steps THEN COALESCE((
        SELECT (SUM(CASE WHEN s.done THEN 1 ELSE 0 END) * 100 + COUNT(*) / 2)
            / NULLIF(COUNT(*), 0)
        FROM plan_steps s WHERE s.goal_id = g.id
    ), 0) ELSE g.progress END
FROM goals g
"""


def upgrade() -> None:
    op.create_table(
        "progress_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_progress_entries_progress_range"),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name="fk_progress_entries_goal_id_goals",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("goal_id", "day", name="uq_progress_entries_goal_id_day"),
    )
    op.execute(FIRST_ENTRIES)


def downgrade() -> None:
    op.drop_table("progress_entries")
