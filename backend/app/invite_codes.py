"""Códigos dos convites: fáceis de ditar e de escrever, e difíceis de adivinhar.

Doze caracteres de um alfabeto sem os que se confundem (0/O, 1/I/L), o que dá quase 60 bits
aleatórios. Mostram-se em grupos de quatro (ABCD-2345-EFGH), mas à entrada aceitam-se
em minúsculas, com ou sem hífenes e espaços.
"""

import re
import secrets

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LENGTH = 12
GROUP = 4


def new_invite_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def normalize_invite_code(text: str) -> str:
    """O código tal como fica guardado: em maiúsculas e só letras e algarismos."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def format_invite_code(code: str) -> str:
    return "-".join(code[i : i + GROUP] for i in range(0, len(code), GROUP))
