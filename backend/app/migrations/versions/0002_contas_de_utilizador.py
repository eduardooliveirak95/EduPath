"""Contas de utilizador: tabela users e o dono de cada objetivo (goals.user_id).

Os objetivos que já existiam ficam sem dono; a primeira conta criada fica com eles.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-16 10:20:29.851665
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_goals_user_id"), ["user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_goals_user_id_users", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.drop_constraint("fk_goals_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_goals_user_id"))
        batch_op.drop_column("user_id")

    op.drop_table("users")
