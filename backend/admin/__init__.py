# Moderation blueprint registration
# From: backend application factory -> To: /api/admin route handlers
from flask import Blueprint

admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/api/admin",
)
