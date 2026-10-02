# Feed blueprint registration
# From: backend application factory -> To: /api/posts route handlers
from flask import Blueprint


feed_bp = Blueprint(
	"feed",
	__name__,
	url_prefix="/api"
)
