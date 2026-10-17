"""Gerir contas na linha de comandos, sem passar pelo site.

Uso:
  uv run python -m app.users set-password EMAIL   # recuperar uma conta (sem recuperação por email)
  uv run python -m app.users set-admin EMAIL      # tornar a conta administradora
  uv run python -m app.users remove-admin EMAIL   # tirar-lhe a administração

Corre contra o DATABASE_URL configurado, por isso para produção é preciso o URL do Neon.
"""

import argparse
import getpass
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.schemas import MIN_PASSWORD_LENGTH
from app.security import hash_password


def find_user(session: Session, email: str) -> User:
    user = session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        sys.exit(f"Não há nenhuma conta com o email {email}.")
    return user


def set_password(email: str) -> None:
    with SessionLocal() as session:
        user = find_user(session, email)
        password = getpass.getpass("Password nova: ")
        if len(password) < MIN_PASSWORD_LENGTH:
            sys.exit(f"A password tem de ter pelo menos {MIN_PASSWORD_LENGTH} caracteres.")
        if getpass.getpass("Repete a password: ") != password:
            sys.exit("As passwords não coincidem.")
        user.password_hash = hash_password(password)
        session.commit()
    print("Password mudada. As sessões abertas dessa conta terminaram.")


def set_admin(email: str, is_admin: bool) -> None:
    with SessionLocal() as session:
        user = find_user(session, email)
        user.is_admin = is_admin
        session.commit()
    print(f"{user.name} {'é agora' if is_admin else 'deixou de ser'} administrador.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gerir contas do EduPath.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("set-password", help="muda a password de uma conta").add_argument("email")
    commands.add_parser("set-admin", help="torna a conta administradora").add_argument("email")
    commands.add_parser("remove-admin", help="tira a administração à conta").add_argument("email")
    args = parser.parse_args()
    match args.command:
        case "set-password":
            set_password(args.email)
        case "set-admin" | "remove-admin":
            set_admin(args.email, args.command == "set-admin")


if __name__ == "__main__":
    main()
