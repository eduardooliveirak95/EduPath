"""Ponto de entrada da API no Vercel (`services.api.entrypoint` no vercel.json da raiz)."""

from app.main import app

__all__ = ["app"]
