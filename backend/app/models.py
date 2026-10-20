from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(StrEnum):
    SAUDE = "saude"
    CARREIRA = "carreira"
    FINANCAS = "financas"
    APRENDIZAGEM = "aprendizagem"
    PESSOAL = "pessoal"


class Outcome(StrEnum):
    """Resultado registado quando o objetivo é avaliado."""

    SUCEDIDO = "sucedido"
    NAO_SUCEDIDO = "nao_sucedido"


class GoalStatus(StrEnum):
    """Estado derivado da data limite e do resultado registado (não é guardado)."""

    EM_CURSO = "em_curso"
    POR_AVALIAR = "por_avaliar"
    SUCEDIDO = "sucedido"
    NAO_SUCEDIDO = "nao_sucedido"


def _string_enum(enum_cls: type[StrEnum]) -> Enum:
    # Guarda o valor ("saude") e não o nome ("SAUDE"), sem tipos ENUM nativos do Postgres.
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda members: [member.value for member in members],
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # Sempre em minúsculas, para o login não depender de maiúsculas.
    email: Mapped[str] = mapped_column(String(254))
    password_hash: Mapped[str] = mapped_column(String(255))
    # O administrador vê a página Administração e é o único que cria convites.
    # A primeira conta criada fica administradora (routers/auth.py e a migração 0004).
    is_admin: Mapped[bool] = mapped_column(default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoginFailure(Base):
    """Tentativa de entrar com a password errada, para limitar as tentativas por email
    (routers/auth.py). Guarda o email escrito, tenha ou não conta, para o limite não revelar
    que emails têm conta. As de há mais tempo do que o limite vão sendo apagadas."""

    __tablename__ = "login_failures"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InviteStatus(StrEnum):
    """Estado derivado da data de validade e de o convite ter sido usado (não é guardado)."""

    POR_USAR = "por_usar"
    USADO = "usado"
    EXPIRADO = "expirado"


class Invite(Base):
    """Convite criado por uma conta: o código serve uma só vez para criar outra conta."""

    __tablename__ = "invites"
    __table_args__ = (UniqueConstraint("code", name="uq_invites_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Guardado sem hífenes ("ABCD2345EFGH"); a API mostra-o como "ABCD-2345-EFGH".
    code: Mapped[str] = mapped_column(String(20))
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_invites_created_by_id_users"),
        index=True,
    )
    # Último dia em que o código serve.
    expires_on: Mapped[date]
    used_on: Mapped[date | None]
    used_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", name="fk_invites_used_by_id_users")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    used_by: Mapped[User | None] = relationship(foreign_keys=[used_by_id], lazy="joined")

    def status(self, today: date) -> InviteStatus:
        if self.used_on is not None:
            return InviteStatus.USADO
        return InviteStatus.EXPIRADO if self.expires_on < today else InviteStatus.POR_USAR


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("progress BETWEEN 0 AND 100", name="ck_goals_progress_range"),
        CheckConstraint("target_date >= start_date", name="ck_goals_dates_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Dono do objetivo. Só fica vazio nos objetivos de antes das contas, até a primeira
    # conta a ser criada ficar com eles (routers/auth.py).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_goals_user_id_users"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[Category] = mapped_column(_string_enum(Category))
    start_date: Mapped[date]
    target_date: Mapped[date]
    progress: Mapped[int] = mapped_column(default=0)
    outcome: Mapped[Outcome | None] = mapped_column(_string_enum(Outcome))
    outcome_note: Mapped[str | None] = mapped_column(Text)
    closed_at: Mapped[date | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    plan: Mapped[list["PlanStep"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="PlanStep.position",
        lazy="selectin",
    )

    def status(self, today: date) -> GoalStatus:
        if self.outcome is not None:
            return GoalStatus(self.outcome.value)
        return GoalStatus.POR_AVALIAR if self.target_date < today else GoalStatus.EM_CURSO


class PlanStep(Base):
    __tablename__ = "plan_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(default=False)
    position: Mapped[int] = mapped_column(default=0)

    goal: Mapped[Goal] = relationship(back_populates="plan")
