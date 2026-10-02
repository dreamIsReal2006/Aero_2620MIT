# Authentication blueprint registration
# From: backend application factory -> To: /api/auth route handlers
from flask import Blueprint

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)
