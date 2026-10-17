import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import ensure_persistent_database, get_settings
from app.database import engine
from app.deps import get_current_user
from app.migrate import should_migrate, upgrade_database
from app.routers import admin, auth, goals, invites, steps


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_persistent_database(get_settings(), os.environ)
    if should_migrate(os.environ):
        upgrade_database(engine)
    yield


app = FastAPI(
    title="EduPath API",
    description="Objetivos pessoais, planos para os alcançar e histórico de resultados.",
    version="0.1.0",
    lifespan=lifespan,
    # Tudo debaixo de /api: no Vercel, o site e a API partilham o mesmo domínio.
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
# Os dados só se veem e alteram com sessão iniciada, e cada conta só vê os seus.
# Sem sessão, só ficam abertos o login, o registo, a documentação e /api/health.
app.include_router(goals.router, dependencies=[Depends(get_current_user)])
app.include_router(steps.router, dependencies=[Depends(get_current_user)])
app.include_router(invites.router, dependencies=[Depends(get_current_user)])
app.include_router(admin.router, dependencies=[Depends(get_current_user)])


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/api/docs")


@app.get("/api/health", tags=["sistema"])
def health() -> dict[str, str]:
    return {"status": "ok"}
