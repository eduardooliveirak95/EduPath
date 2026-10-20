"""Tentativas de login falhadas, para limitar as passwords erradas por email.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-20 11:14:40.381800
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_failures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("login_failures", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_login_failures_email"), ["email"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("login_failures", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_login_failures_email"))

    op.drop_table("login_failures")
