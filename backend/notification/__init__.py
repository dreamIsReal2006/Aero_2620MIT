from flask import Blueprint

notification_bp = Blueprint(
    "notification",
    __name__,
    url_prefix="/api",
)
