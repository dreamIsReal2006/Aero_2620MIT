from flask import Blueprint

interact_bp = Blueprint(
    "interact",
    __name__,
    url_prefix="/interact"
)
