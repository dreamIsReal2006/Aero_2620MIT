from functools import wraps

import jwt
from flask import abort, current_app, g, request, session

from backend import db
from backend.models import User


def _authenticated_user():
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        try:
            payload = jwt.decode(
                authorization[7:].strip(),
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
            return db.session.get(User, payload["user_id"])
        except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
            return None

    user_id = session.get("user_id")
    return db.session.get(User, user_id) if user_id else None


def login_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        current_user = _authenticated_user()
        if not current_user or not current_user.is_authenticated:
            abort(401)
        g.current_user = current_user
        return function(*args, **kwargs)

    return decorated


def admin_required(function):
    return require_role("admin")(function)


def require_role(roles):
    allowed_roles = {str(role).strip().lower() for role in (roles if isinstance(roles, (list, tuple, set)) else [roles])}

    def decorator(function):
        @wraps(function)
        def decorated(*args, **kwargs):
            current_user = getattr(g, "current_user", None) or _authenticated_user()
            if not current_user or not current_user.is_authenticated:
                abort(403)
            effective_role = "admin" if current_user.is_admin else current_user.role
            if effective_role not in {"admin", "moderator", "user"} or effective_role not in allowed_roles:
                abort(403)
            g.current_user = current_user
            return function(*args, **kwargs)

        return decorated

    return decorator
