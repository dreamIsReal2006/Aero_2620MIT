import os

from flask import Blueprint


admin_secret_path = os.getenv("ADMIN_SECRET_PATH", "default_fallback").strip() or "default_fallback"


admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix=f"/api/admin_{admin_secret_path}",
)
