"""Administrador (users.is_admin).

A primeira conta criada (a de menor id) fica administradora.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-17 10:12:41.512310
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False)
        )

    users = sa.table("users", sa.column("id", sa.Integer), sa.column("is_admin", sa.Boolean))
    first = sa.select(sa.func.min(users.c.id)).scalar_subquery()
    op.execute(users.update().where(users.c.id == first).values(is_admin=True))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("is_admin")
