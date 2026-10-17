"""Preenche a base de dados com uma conta de demonstração e os objetivos de exemplo.

Uso: uv run python -m app.seed [--reset]

Só para desenvolvimento: a conta de demonstração tem uma password conhecida.
"""

import argparse
from datetime import date, timedelta
from typing import NamedTuple

from sqlalchemy import func, select, text

from app.config import get_today
from app.database import Base, SessionLocal, engine
from app.migrate import upgrade_database
from app.models import Category, Goal, Outcome, PlanStep, User
from app.security import hash_password

C = Category

DEMO_NAME = "Demo"
DEMO_EMAIL = "demo@edupath.pt"
DEMO_PASSWORD = "edupath-demo"


class Sample(NamedTuple):
    """Objetivo de exemplo. As datas são dias relativos a hoje (negativo = passado)."""

    title: str
    description: str | None
    category: Category
    start: int
    target: int
    progress: int
    steps: list[tuple[str, bool]]
    outcome: Outcome | None = None
    note: str | None = None
    closed: int | None = None


# Há sempre objetivos em curso, por avaliar e já avaliados, seja qual for o dia de hoje.
# fmt: off
SAMPLE_GOALS = [
    Sample("Correr uma meia maratona", "Completar os 21 km em menos de 2h15.",
           C.SAUDE, -60, 68, 45,
           [("Correr 3 vezes por semana", True), ("Chegar aos 10 km sem parar", True),
            ("Chegar aos 15 km", False), ("Inscrever-me na prova", False),
            ("Fazer um treino longo de 18 km", False)]),
    Sample("Fundo de emergência de 5 000 €", "Juntar o equivalente a 6 meses de despesas fixas.",
           C.FINANCAS, -150, 120, 62,
           [("Definir orçamento mensal", True), ("Transferência automática de 400 €/mês", True),
            ("Cancelar subscrições que não uso", True),
            ("Rever gastos no fim do trimestre", False)]),
    Sample("Ler 24 livros este ano", "Dois livros por mês, alternando ficção e não-ficção.",
           C.APRENDIZAGEM, -288, 77, 71,
           [("Criar lista de leitura", True), ("Ler 30 minutos antes de dormir", True),
            ("Terminar o livro 18", False), ("Escrever uma nota sobre cada livro", False)]),
    Sample("Certificação AWS Solutions Architect",
           "Passar no exame associate à primeira tentativa.",
           C.CARREIRA, -30, 45, 30,
           [("Escolher o curso de preparação", True), ("Concluir o curso online (40 h)", False),
            ("Fazer 3 exames simulados", False), ("Marcar a data do exame", False)]),
    Sample("Meditar 10 minutos por dia", "90 dias seguidos sem falhar.",
           C.PESSOAL, -72, 18, 80,
           [("Escolher uma app de meditação", True), ("Meditar logo depois de acordar", True),
            ("Chegar aos 60 dias seguidos", True), ("Chegar aos 90 dias seguidos", False)]),
    Sample("Lançar o meu portefólio online", "Site pessoal com 4 projetos e CV atualizado.",
           C.CARREIRA, -14, 9, 15,
           [("Escolher domínio e alojamento", True), ("Desenhar a página inicial", False),
            ("Escrever os textos dos projetos", False),
            ("Publicar e partilhar no LinkedIn", False)]),
    Sample("Perder 5 kg", None, C.SAUDE, -93, -3, 90,
           [("Cozinhar em casa 5 dias por semana", True), ("Ginásio 3 vezes por semana", True),
            ("Cortar refrigerantes", True)]),
    Sample("Terminar o curso de Python", None, C.APRENDIZAGEM, -61, -1, 100,
           [("Módulos 1 a 6", True), ("Projeto final", True)]),
    Sample("Viagem ao Japão", None, C.PESSOAL, -300, -40, 100,
           [("Poupar 3 000 €", True), ("Reservar voos e alojamento", True)],
           Outcome.SUCEDIDO, "Duas semanas entre Tóquio, Quioto e Osaka.", -38),
    Sample("Deixar de fumar", None, C.SAUDE, -150, -25, 40,
           [("Marcar consulta de cessação", True), ("30 dias sem fumar", False)],
           Outcome.NAO_SUCEDIDO, "Recaída ao fim de 2 meses. Voltar a tentar com acompanhamento.",
           -24),
    Sample("Pedir aumento salarial", None, C.CARREIRA, -120, -70, 100,
           [("Preparar lista de conquistas", True), ("Reunião com a chefia", True)],
           Outcome.SUCEDIDO, "Aumento de 8% aprovado.", -68),
    Sample("Poupar para portátil novo", None, C.FINANCAS, -200, -100, 100,
           [("Pôr de parte 150 €/mês", True)],
           Outcome.SUCEDIDO, None, -99),
]
# fmt: on


def build_sample_goals(today: date, user_id: int) -> list[Goal]:
    def day(offset: int) -> date:
        return today + timedelta(days=offset)

    return [
        Goal(
            user_id=user_id,
            title=sample.title,
            description=sample.description,
            category=sample.category,
            start_date=day(sample.start),
            target_date=day(sample.target),
            progress=sample.progress,
            plan=[
                PlanStep(title=title, done=done, position=index)
                for index, (title, done) in enumerate(sample.steps)
            ],
            outcome=sample.outcome,
            outcome_note=sample.note,
            closed_at=None if sample.closed is None else day(sample.closed),
        )
        for sample in SAMPLE_GOALS
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Carrega os objetivos de exemplo.")
    parser.add_argument("--reset", action="store_true", help="apaga todos os dados antes")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    upgrade_database(engine)

    with SessionLocal() as session:
        if session.scalar(select(func.count()).select_from(Goal)):
            print("A base de dados já tem objetivos. Usa --reset para recomeçar.")
            return
        user = session.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is None:
            # Como no registo, a primeira conta fica administradora.
            first_account = session.scalar(select(func.count()).select_from(User)) == 0
            user = User(
                name=DEMO_NAME,
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                is_admin=first_account,
            )
            session.add(user)
            session.flush()
        session.add_all(build_sample_goals(get_today(), user.id))
        session.commit()
    print(f"{len(SAMPLE_GOALS)} objetivos de exemplo criados.")
    print(f"Entra com {DEMO_EMAIL} e a password {DEMO_PASSWORD}.")


if __name__ == "__main__":
    main()
