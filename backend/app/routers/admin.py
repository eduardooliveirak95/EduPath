from fastapi import APIRouter
from sqlalchemy import select

from app.deps import AdminDep, SessionDep
from app.models import User
from app.schemas import AdminUserRead

# Só para o administrador (AdminDep). Mostra que as contas existem, e nada mais:
# os objetivos de cada pessoa são privados e não aparecem aqui (nem quantos são).
router = APIRouter(prefix="/api/admin", tags=["administração"])


@router.get("/users", response_model=list[AdminUserRead])
def list_users(session: SessionDep, _admin: AdminDep):
    """As contas que existem, pela ordem em que foram criadas."""
    return session.scalars(select(User).order_by(User.id)).all()
