"""Convites criados no site: cada código serve uma vez para criar uma conta e expira.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-16 12:27:59.971141
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=False),
        sa.Column("used_on", sa.Date(), nullable=True),
        sa.Column("used_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_invites_created_by_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["used_by_id"], ["users.id"], name="fk_invites_used_by_id_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_invites_code"),
    )
    with op.batch_alter_table("invites", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_invites_created_by_id"), ["created_by_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("invites", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_invites_created_by_id"))

    op.drop_table("invites")
