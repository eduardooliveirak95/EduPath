from datetime import date, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_now, get_settings, get_today
from app.database import get_session
from app.models import Goal, User
from app.security import password_fingerprint, read_token

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
NowDep = Annotated[datetime, Depends(get_now)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

# auto_error=False: sem token, quem responde é get_current_user, com a mensagem em português.
bearer = HTTPBearer(auto_error=False, description="Token devolvido por POST /api/auth/login.")
CredentialsDep = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def get_current_user(
    session: SessionDep, settings: SettingsDep, credentials: CredentialsDep
) -> User:
    """A conta da sessão. Recusa o pedido (401) sem um token válido de uma conta que exista."""
    claims = read_token(credentials.credentials, settings) if credentials else None
    user = session.get(User, claims.user_id) if claims else None
    # Se a password mudou entretanto, os tokens antigos deixam de servir.
    if user is None or claims.fingerprint != password_fingerprint(user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "A sessão terminou ou não é válida. Entra outra vez.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_admin_user(user: CurrentUserDep) -> User:
    """A conta da sessão, se for a do administrador (403 para as outras)."""
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só o administrador pode fazer isto.")
    return user


AdminDep = Annotated[User, Depends(get_admin_user)]


def get_goal_or_404(session: Session, goal_id: int, user: User, *, lock: bool = False) -> Goal:
    """O objetivo, se for desta conta. Os de outras contas também dão 404 (não existem para ela).

    Com `lock`, fica bloqueado até ao fim do pedido (SELECT ... FOR UPDATE, no Postgres): dois
    pedidos que mudam o mesmo objetivo ao mesmo tempo (ex.: marcar dois passos seguidos) correm
    um depois do outro, e o segundo já vê o que o primeiro mudou. Sem isso, a evolução do
    progresso podia ficar com um valor antigo, ou falhar ao criar o registo do dia duas vezes.
    """
    goal = session.get(Goal, goal_id, with_for_update=lock)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Objetivo não encontrado.")
    return goal
