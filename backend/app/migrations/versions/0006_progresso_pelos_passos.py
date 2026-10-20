"""Progresso calculado pelos passos (goals.progress_from_steps).

Os objetivos que já existem continuam com o progresso escolhido à mão.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-20 18:05:12.104221
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "progress_from_steps", sa.Boolean(), server_default=sa.false(), nullable=False
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.drop_column("progress_from_steps")
