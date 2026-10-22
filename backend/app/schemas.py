import re
from datetime import date, datetime
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)
from pydantic.alias_generators import to_camel

from app.invite_codes import format_invite_code
from app.models import Category, Goal, GoalStatus, Invite, InviteStatus, Outcome

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Progress = Annotated[int, Field(ge=0, le=100)]

DATES_ORDER_ERROR = "A data limite não pode ser anterior à data de início."


class ApiModel(BaseModel):
    """JSON em camelCase (como no frontend); também aceita snake_case à entrada."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        from_attributes=True,
    )

    def changes(self) -> dict:
        """Campos enviados num PATCH, com os nomes dos atributos (snake_case)."""
        return self.model_dump(exclude_unset=True, by_alias=False)


def reject_nulls(model: BaseModel, fields: tuple[str, ...]) -> None:
    """Num PATCH, um campo omitido não muda; mas `null` não é válido em campos obrigatórios."""
    for name in fields:
        if name in model.model_fields_set and getattr(model, name) is None:
            raise ValueError(f"O campo '{to_camel(name)}' não pode ser nulo.")


# Passos do plano


class PlanStepCreate(ApiModel):
    title: Title
    done: bool = False


class PlanStepUpdate(ApiModel):
    title: Title | None = None
    done: bool | None = None

    @model_validator(mode="after")
    def _no_nulls(self) -> Self:
        reject_nulls(self, ("title", "done"))
        return self


class PlanStepEdit(ApiModel):
    """Passo enviado ao editar o plano inteiro: com `id` é um passo que já existe."""

    id: int | None = None
    title: Title
    done: bool = False


class PlanStepRead(ApiModel):
    id: int
    title: str
    done: bool
    position: int


# Objetivos


TimesPerWeek = Annotated[int, Field(ge=1, le=7)]
RECURRING = "Objetivo recorrente: quantas vezes por semana (de segunda a domingo)."


class Weeks(ApiModel):
    met: int
    total: int


class GoalCreate(ApiModel):
    title: Title
    description: LongText | None = None
    category: Category
    start_date: date | None = Field(default=None, description="Por omissão, a data de hoje.")
    target_date: date
    progress: Progress = 0
    progress_from_steps: bool = Field(
        default=False, description="Se for true, o progresso é a percentagem de passos feitos."
    )
    times_per_week: TimesPerWeek | None = Field(default=None, description=RECURRING)
    plan: list[PlanStepCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _dates_in_order(self) -> Self:
        if self.start_date is not None and self.target_date < self.start_date:
            raise ValueError(DATES_ORDER_ERROR)
        return self


class GoalUpdate(ApiModel):
    title: Title | None = None
    description: LongText | None = None
    category: Category | None = None
    start_date: date | None = None
    target_date: date | None = None
    progress: Progress | None = None
    progress_from_steps: bool | None = None
    times_per_week: TimesPerWeek | None = Field(
        default=None, description=f"{RECURRING} Com null, deixa de ser recorrente."
    )
    plan: list[PlanStepEdit] | None = Field(
        default=None,
        description=(
            "Se for enviado, substitui o plano: os passos com id mantêm-se (e são atualizados), "
            "os sem id são novos e os que faltarem são apagados. A ordem da lista é a do plano."
        ),
    )
    outcome_note: LongText | None = Field(
        default=None,
        description="Nota da avaliação. Só em objetivos já avaliados; vazia ou null apaga-a.",
    )

    @model_validator(mode="after")
    def _no_nulls(self) -> Self:
        reject_nulls(
            self,
            (
                "title",
                "category",
                "start_date",
                "target_date",
                "progress",
                "progress_from_steps",
                "plan",
            ),
        )
        return self


class GoalRead(ApiModel):
    id: int
    title: str
    description: str | None
    category: Category
    start_date: date
    target_date: date
    progress: int = Field(
        description=(
            "Num objetivo recorrente, a percentagem de semanas cumpridas; com progressFromSteps,"
            " a de passos feitos (sem passos, 0)."
        )
    )
    progress_from_steps: bool
    times_per_week: int | None = Field(description=RECURRING)
    checkins: list[date] = Field(description="Dias registados (só nos objetivos recorrentes).")
    weeks: Weeks | None = Field(description="Semanas do objetivo recorrente e quantas cumpridas.")
    status: GoalStatus
    plan: list[PlanStepRead]
    outcome: Outcome | None
    outcome_note: str | None
    closed_at: date | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_goal(cls, goal: Goal, today: date) -> Self:
        weeks = goal.weeks()
        derived = {
            "status": goal.status(today),
            "progress": goal.current_progress(),
            "checkins": [checkin.day for checkin in goal.checkins],
            "weeks": weeks and Weeks(met=weeks.met, total=weeks.total),
        }
        data = {name: getattr(goal, name) for name in cls.model_fields if name not in derived}
        return cls.model_validate({**data, **derived})


class ProgressPoint(ApiModel):
    """A percentagem de um objetivo num dia (o último valor desse dia)."""

    day: date
    progress: int


class EvaluationCreate(ApiModel):
    outcome: Outcome
    note: LongText | None = None


# Contas e sessão

MIN_PASSWORD_LENGTH = 10
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_email(email: str) -> str:
    if not EMAIL_PATTERN.match(email):
        raise ValueError("O email não é válido.")
    return email


def _check_new_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"A password tem de ter pelo menos {MIN_PASSWORD_LENGTH} caracteres.")
    return password


# Em minúsculas e sem espaços nas pontas: "Eu@Mail.pt " e "eu@mail.pt" são a mesma conta.
EmailInput = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254)]
Email = Annotated[EmailInput, AfterValidator(_check_email)]
Password = Annotated[str, StringConstraints(max_length=200)]
NewPassword = Annotated[Password, AfterValidator(_check_new_password)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class UserRead(ApiModel):
    id: int
    name: str
    email: str
    is_admin: bool


class LoginRequest(ApiModel):
    email: EmailInput
    password: Password


class RegisterRequest(ApiModel):
    name: Name
    email: Email
    password: NewPassword
    invite_code: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class ProfileUpdate(ApiModel):
    name: Name


class PasswordChange(ApiModel):
    current_password: Password
    new_password: NewPassword


class AccountDelete(ApiModel):
    """Apagar a própria conta: pede a password, para confirmar."""

    password: Password


class SessionRead(ApiModel):
    """Resposta de entrar, criar conta, renovar a sessão e mudar a password."""

    token: str
    expires_at: datetime
    user: UserRead


# Convites


class InviteRead(ApiModel):
    id: int
    code: str = Field(description="Código a dar a quem vai criar a conta (ex.: ABCD-2345-EFGH).")
    status: InviteStatus
    expires_on: date = Field(description="Último dia em que o código serve.")
    used_on: date | None
    used_by: str | None = Field(description="Nome de quem criou a conta com este convite.")

    @classmethod
    def from_invite(cls, invite: Invite, today: date) -> Self:
        return cls(
            id=invite.id,
            code=format_invite_code(invite.code),
            status=invite.status(today),
            expires_on=invite.expires_on,
            used_on=invite.used_on,
            used_by=invite.used_by.name if invite.used_by else None,
        )


# Administração


class AdminUserRead(ApiModel):
    """Uma conta, vista pelo administrador: só que existe. Nada dos objetivos dela."""

    id: int
    name: str
    email: str
    is_admin: bool
    created_at: datetime


class TemporaryPassword(ApiModel):
    """Password nova de uma conta, dada pelo administrador. Só aparece nesta resposta."""

    password: str
