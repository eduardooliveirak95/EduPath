"""Passwords e sessões das contas.

As passwords são guardadas só como hash Argon2id, nunca em claro.

Quem entra recebe um token de sessão (JWT assinado com SESSION_SECRET) que o frontend
envia em cada pedido, no cabeçalho `Authorization: Bearer <token>`. O token não fica
guardado no servidor. Leva o id da conta (`sub`) e uma impressão digital do hash da
password (`pwd`): mudar a password termina as outras sessões dessa conta, e mudar
SESSION_SECRET termina todas.
"""

import hashlib
import hmac
from datetime import datetime, timedelta
from functools import cache
from typing import NamedTuple

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import Settings
from app.invite_codes import format_invite_code, new_invite_code
from app.models import User
from app.schemas import SessionRead, UserRead

MIN_SECRET_LENGTH = 32
ALGORITHM = "HS256"

_hasher = PasswordHasher()


def config_error(settings: Settings) -> str | None:
    """O que falta configurar para as contas funcionarem, ou None se estiver tudo certo."""
    if len(settings.session_secret) < MIN_SECRET_LENGTH:
        return f"SESSION_SECRET tem de ter pelo menos {MIN_SECRET_LENGTH} caracteres."
    return None


def new_temporary_password() -> str:
    """Password temporária para quem perdeu a sua: no formato dos convites (ABCD-2345-EFGH),
    fácil de ditar e de escrever, com quase 60 bits aleatórios."""
    return format_invite_code(new_invite_code())


def secrets_match(given: str, expected: str) -> bool:
    """Compara em tempo constante (ex.: o código de convite)."""
    digest = lambda text: hashlib.sha256(text.encode()).digest()  # noqa: E731
    return hmac.compare_digest(digest(given), digest(expected))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


@cache
def _unknown_account_hash() -> str:
    return hash_password("conta-que-não-existe")


def verify_password(password_hash: str | None, password: str) -> bool:
    """Sem conta (hash None), verifica na mesma contra um hash qualquer: a resposta demora
    o mesmo e não denuncia que emails têm conta."""
    try:
        _hasher.verify(password_hash or _unknown_account_hash(), password)
    except (VerificationError, InvalidHashError):
        return False
    return password_hash is not None


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_session(user: User, settings: Settings, now: datetime) -> SessionRead:
    """Novo token para a conta, válido durante `session_days` a contar de `now`."""
    now = now.replace(microsecond=0)  # o JWT guarda as datas em segundos
    expires_at = now + timedelta(days=settings.session_days)
    claims = {
        "sub": str(user.id),
        "pwd": password_fingerprint(user.password_hash),
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(claims, settings.session_secret, ALGORITHM)
    return SessionRead(token=token, expires_at=expires_at, user=UserRead.model_validate(user))


class TokenClaims(NamedTuple):
    user_id: int
    fingerprint: str


def read_token(token: str, settings: Settings) -> TokenClaims | None:
    """O que o token diz, se a assinatura e a validade estiverem certas."""
    if config_error(settings) is not None:
        return None
    try:
        claims = jwt.decode(
            token,
            settings.session_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "pwd"]},
        )
        return TokenClaims(int(claims["sub"]), str(claims["pwd"]))
    except (jwt.InvalidTokenError, ValueError):
        return None
