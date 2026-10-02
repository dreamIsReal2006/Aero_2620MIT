# Chat blueprint registration
# From: backend application factory -> To: /api/chat route handlers
from flask import Blueprint

chat_bp = Blueprint("chat", __name__, url_prefix="/api")
