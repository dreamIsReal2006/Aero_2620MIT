# Message blueprint registration
# From: backend application factory -> To: /api/messages route handlers
from flask import Blueprint

messages_bp = Blueprint(
    "messages",
    __name__,
    url_prefix="/api/messages",
)
