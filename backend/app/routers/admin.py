from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.deps import AdminDep, SessionDep
from app.models import LoginFailure, User
from app.schemas import AdminUserRead, TemporaryPassword
from app.security import hash_password, new_temporary_password

# Só para o administrador (AdminDep). Mostra que as contas existem, e nada mais:
# os objetivos de cada pessoa são privados e não aparecem aqui (nem quantos são).
router = APIRouter(prefix="/api/admin", tags=["administração"])


@router.get("/users", response_model=list[AdminUserRead])
def list_users(session: SessionDep, _admin: AdminDep):
    """As contas que existem, pela ordem em que foram criadas."""
    return session.scalars(select(User).order_by(User.id)).all()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: SessionDep, _admin: AdminDep):
    """Apaga uma conta e tudo o que é dela: objetivos, passos e os convites que criou.

    É a base de dados que apaga o resto (ON DELETE CASCADE); nos convites que a conta
    usou, fica só o registo, sem o nome. A sessão dela termina no pedido seguinte.
    """
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada.")
    if user.is_admin:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Não dá para remover a conta de um administrador."
        )
    session.delete(user)
    session.commit()


@router.post("/users/{user_id}/password", response_model=TemporaryPassword)
def reset_password(user_id: int, session: SessionDep, _admin: AdminDep):
    """Dá uma password nova a uma conta, para quem perdeu a sua. Só aparece nesta resposta:
    o administrador passa-a à pessoa, que a pode mudar depois nas Definições.

    A password antiga deixa de servir e as sessões abertas da conta terminam (como ao mudar
    a password). As tentativas de login falhadas desse email deixam de contar.
    """
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada.")
    if user.is_admin:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Não dá para repor a password de um administrador. Muda-a nas Definições.",
        )
    password = new_temporary_password()
    user.password_hash = hash_password(password)
    session.execute(delete(LoginFailure).where(LoginFailure.email == user.email))
    session.commit()
    return TemporaryPassword(password=password)
