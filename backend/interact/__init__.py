# Interaction blueprint registration
# From: backend application factory -> To: /api/interact route handlers
from flask import Blueprint

interact_bp = Blueprint(
    "interact",
    __name__,
    url_prefix="/interact"
)
