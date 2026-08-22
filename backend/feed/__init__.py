from flask import Blueprint


feed_bp = Blueprint(
	"feed",
	__name__,
	url_prefix="/api"
)
