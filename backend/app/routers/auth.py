from datetime import UTC, date, datetime, timedelta
from math import ceil

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import CurrentUserDep, NowDep, SessionDep, SettingsDep, TodayDep
from app.invite_codes import normalize_invite_code
from app.models import Goal, Invite, InviteStatus, LoginFailure, User
from app.schemas import (
    AccountDelete,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    SessionRead,
    UserRead,
)
from app.security import (
    config_error,
    create_session,
    hash_password,
    secrets_match,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["contas"])

EMAIL_TAKEN = "Já existe uma conta com este email."
INVITE_USED = "Este convite já foi usado. Pede um convite novo."

# Com MAX_LOGIN_FAILURES passwords erradas para o mesmo email em LOGIN_FAILURE_WINDOW,
# esse email fica bloqueado até a mais antiga delas sair da janela.
MAX_LOGIN_FAILURES = 5
LOGIN_FAILURE_WINDOW = timedelta(minutes=15)


def ensure_configured(settings: Settings) -> None:
    problem = config_error(settings)
    if problem is not None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            f"As contas ainda não estão configuradas no servidor. {problem}",
        )


def find_invite(
    session: Session, code: str, settings: Settings, today: date, first_account: bool
) -> Invite | None:
    """O convite do administrador com este código, ou None se for o INVITE_CODE (que só
    serve para criar a primeira conta). Recusa (403) qualquer outro código, ou um convite
    que já não serve."""
    invite = session.scalar(select(Invite).where(Invite.code == normalize_invite_code(code)))
    if invite is None:
        if first_account and settings.invite_code and secrets_match(code, settings.invite_code):
            return None
        raise HTTPException(status.HTTP_403_FORBIDDEN, "O código de convite está errado.")
    # Só o administrador convida: um convite de outra conta (de antes desta regra) já não serve.
    creator = session.get(User, invite.created_by_id)
    if creator is None or not creator.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Este convite já não é válido. Pede um convite novo."
        )
    match invite.status(today):
        case InviteStatus.USADO:
            raise HTTPException(status.HTTP_403_FORBIDDEN, INVITE_USED)
        case InviteStatus.EXPIRADO:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Este convite expirou. Pede um convite novo."
            )
    return invite


@router.post("/register", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: SessionDep, settings: SettingsDep, today: TodayDep):
    """Cria uma conta e entra logo nela. É preciso um convite do administrador (de uso
    único). A primeira conta cria-se com o código da configuração (INVITE_CODE) e fica
    administradora."""
    ensure_configured(settings)
    is_first_account = session.scalar(select(func.count()).select_from(User)) == 0
    # O código vem antes do email: sem ele não se fica a saber que emails têm conta.
    invite = find_invite(session, payload.invite_code, settings, today, is_first_account)
    if session.scalar(select(User.id).where(User.email == payload.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_admin=is_first_account,
    )
    session.add(user)
    try:
        session.flush()
    except IntegrityError:  # duas contas com o mesmo email ao mesmo tempo
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN) from None
    if invite is not None:
        # Só gasta o convite se ainda estiver por usar: com dois registos ao mesmo tempo,
        # um deles falha e a conta dele não chega a ser criada (não há commit).
        claimed = session.execute(
            update(Invite)
            .where(Invite.id == invite.id, Invite.used_on.is_(None))
            .values(used_on=today, used_by_id=user.id)
        )
        if claimed.rowcount != 1:
            raise HTTPException(status.HTTP_403_FORBIDDEN, INVITE_USED)
    if is_first_account:
        # Os objetivos de antes de haver contas passam a ser da primeira conta.
        session.execute(update(Goal).where(Goal.user_id.is_(None)).values(user_id=user.id))
    session.commit()
    return create_session(user, settings, datetime.now(UTC))


def login_blocked_for(session: Session, email: str, now: datetime) -> timedelta | None:
    """Quanto falta para este email poder tentar outra vez, ou None se não estiver bloqueado."""
    recent = session.scalars(
        select(LoginFailure.created_at)
        .where(LoginFailure.email == email, LoginFailure.created_at > now - LOGIN_FAILURE_WINDOW)
        .order_by(LoginFailure.created_at.desc())
        .limit(MAX_LOGIN_FAILURES)
    ).all()
    if len(recent) < MAX_LOGIN_FAILURES:
        return None
    oldest = recent[-1].replace(tzinfo=UTC)  # o SQLite devolve as datas sem fuso horário
    return oldest + LOGIN_FAILURE_WINDOW - now


@router.post("/login", response_model=SessionRead)
def login(payload: LoginRequest, session: SessionDep, settings: SettingsDep, now: NowDep):
    """Troca o email e a password por um token de sessão. Depois de 5 passwords erradas em
    15 minutos, o email fica bloqueado durante algum tempo (429)."""
    ensure_configured(settings)
    # Antes de ver a password: bloqueado, nem a password certa entra (senão, dava para
    # continuar a adivinhar). Vale igual para emails com e sem conta.
    wait = login_blocked_for(session, payload.email, now)
    if wait is not None:
        minutes = max(1, ceil(wait.total_seconds() / 60))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Demasiadas tentativas falhadas. Espera "
            + ("1 minuto" if minutes == 1 else f"{minutes} minutos")
            + " e tenta outra vez.",
            headers={"Retry-After": str(ceil(wait.total_seconds()))},
        )

    user = session.scalar(select(User).where(User.email == payload.email))
    if not verify_password(user.password_hash if user else None, payload.password):
        session.add(LoginFailure(email=payload.email, created_at=now))
        session.execute(
            delete(LoginFailure).where(LoginFailure.created_at <= now - LOGIN_FAILURE_WINDOW)
        )
        session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou password errados.")
    # Ao entrar, as tentativas falhadas deste email deixam de contar.
    session.execute(delete(LoginFailure).where(LoginFailure.email == payload.email))
    session.commit()
    return create_session(user, settings, datetime.now(UTC))


@router.post("/refresh", response_model=SessionRead)
def refresh(user: CurrentUserDep, settings: SettingsDep):
    """Troca um token ainda válido por um novo, para a sessão não expirar enquanto é usada."""
    return create_session(user, settings, datetime.now(UTC))


@router.get("/me", response_model=UserRead)
def me(user: CurrentUserDep):
    return user


@router.patch("/me", response_model=UserRead)
def update_profile(payload: ProfileUpdate, user: CurrentUserDep, session: SessionDep):
    user.name = payload.name
    session.commit()
    return user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(payload: AccountDelete, user: CurrentUserDep, session: SessionDep):
    """Apaga a própria conta e tudo o que é dela: objetivos, passos e os convites que criou.

    Pede a password, para ninguém a apagar só por ter a app aberta. A conta do
    administrador não se apaga (409): só ele convida e dá passwords novas.
    """
    if user.is_admin:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A conta do administrador não pode ser apagada."
        )
    # 403 e não 401: um 401 faria o frontend terminar a sessão.
    if not verify_password(user.password_hash, payload.password):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A password está errada.")
    session.delete(user)
    session.commit()


@router.post("/password", response_model=SessionRead)
def change_password(
    payload: PasswordChange, user: CurrentUserDep, session: SessionDep, settings: SettingsDep
):
    """Muda a password. As outras sessões da conta terminam; esta recebe um token novo."""
    # 403 e não 401: um 401 faria o frontend terminar a sessão.
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A password atual está errada.")
    user.password_hash = hash_password(payload.new_password)
    session.commit()
    return create_session(user, settings, datetime.now(UTC))
