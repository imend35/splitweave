import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import router
from app.config import Settings, get_settings
from app.errors import DomainError
from app.repositories.base import GroupRepository
from app.repositories.sqlalchemy import SQLAlchemyRepository
from app.seed import build_demo_group
from app.services.splitweave import SplitWeaveService

logger = logging.getLogger("splitweave")


def error_payload(code: str, message: str, details: list[dict] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}


def create_app(
    *,
    repository: GroupRepository | None = None,
    settings: Settings | None = None,
) -> FastAPI:
    active_settings = settings or get_settings()
    if repository is None:
        active_repository = SQLAlchemyRepository(active_settings.database_url)
        if not active_repository.list():
            active_repository.save(build_demo_group())
    else:
        active_repository = repository

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info("SplitWeave API started with %s", type(active_repository).__name__)
        yield
        active_repository.close()

    app = FastAPI(
        title=active_settings.app_name,
        version=active_settings.app_version,
        description=(
            "REST API for transparent shared-expense tracking, deterministic splits, "
            "balances, and repayments."
        ),
        lifespan=lifespan,
        openapi_url=f"{active_settings.api_prefix}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.state.splitweave_service = SplitWeaveService(active_repository)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content=error_payload(error.code, error.message, error.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        details = [
            {
                "location": ".".join(str(part) for part in item["loc"]),
                "message": item["msg"],
                "type": item["type"],
            }
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=error_payload(
                "VALIDATION_ERROR",
                "The request contains invalid or missing fields.",
                details,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
        message = str(error.detail)
        code = "ROUTE_NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR"
        return JSONResponse(
            status_code=error.status_code,
            content=error_payload(code, message),
        )

    app.include_router(router, prefix=active_settings.api_prefix)
    return app


app = create_app()
