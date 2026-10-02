# Video blueprint registration
# From: backend application factory -> To: /api/video route handlers
from flask import Blueprint

video_bp = Blueprint("video", __name__, url_prefix="/api")
