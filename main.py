"""FastAPI entrypoint for Aero.

The existing Flask application is mounted as a WSGI compatibility layer so all
legacy API paths and their business logic remain available during migration.
New native FastAPI routes can be added under the same ``/api`` prefix without
changing the public contract.
"""

import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from a2wsgi import WSGIMiddleware

from app import app as flask_app


allowed_origins = [
    origin.strip()
    for origin in os.environ.get("AERO_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins.extend([
    "https://aero-g04.netlify.app",
    "https://GOH.pythonanywhere.com",
    "http://localhost:3000",
])

app = FastAPI(title="Aero API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allowed_origins)),
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

router = APIRouter(prefix="/api")


@router.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "aero"}


app.include_router(router)

# Keep every existing Flask blueprint and static route reachable at its exact
# path while individual domains are migrated to native FastAPI routers.
app.mount("/", WSGIMiddleware(flask_app))