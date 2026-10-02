# Social relationship blueprint registration
# From: backend application factory -> To: /api/social route handlers
from flask import Blueprint


social_bp = Blueprint(
	"social",
	__name__,
	url_prefix="/api"
)
