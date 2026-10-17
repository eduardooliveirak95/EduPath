from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import AdminDep, SessionDep, TodayDep
from app.invite_codes import new_invite_code
from app.models import Invite
from app.schemas import InviteRead

# Só o administrador cria e vê convites (AdminDep).
router = APIRouter(prefix="/api/invites", tags=["convites"])

# O código serve até ao fim do 7.º dia depois de ser criado.
INVITE_DAYS = 7
# Para um engano não encher a BD de convites.
MAX_PENDING_INVITES = 10


@router.get("", response_model=list[InviteRead])
def list_invites(session: SessionDep, user: AdminDep, today: TodayDep):
    """Os convites criados por esta conta, do mais recente para o mais antigo."""
    query = (
        select(Invite)
        .where(Invite.created_by_id == user.id)
        .order_by(Invite.created_at.desc(), Invite.id.desc())
    )
    return [InviteRead.from_invite(invite, today) for invite in session.scalars(query)]


@router.post("", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
def create_invite(session: SessionDep, user: AdminDep, today: TodayDep):
    """Cria um convite: o código serve uma só vez e expira ao fim de 7 dias."""
    pending = session.scalar(
        select(func.count())
        .select_from(Invite)
        .where(
            Invite.created_by_id == user.id,
            Invite.used_on.is_(None),
            Invite.expires_on >= today,
        )
    )
    if pending >= MAX_PENDING_INVITES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Já tens {MAX_PENDING_INVITES} convites por usar. Cancela algum antes de criar outro.",
        )

    invite = Invite(
        code=new_invite_code(),
        created_by_id=user.id,
        expires_on=today + timedelta(days=INVITE_DAYS),
    )
    session.add(invite)
    session.commit()
    return InviteRead.from_invite(invite, today)


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invite(invite_id: int, session: SessionDep, user: AdminDep):
    """Cancela um convite por usar, ou tira da lista um que já foi usado ou expirou."""
    invite = session.get(Invite, invite_id)
    if invite is None or invite.created_by_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Convite não encontrado.")
    session.delete(invite)
    session.commit()
