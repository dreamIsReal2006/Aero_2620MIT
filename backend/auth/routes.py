import datetime as dt
import json
import logging
import os
import secrets
import re
from functools import wraps
from urllib import error as urllib_error
from urllib import request as urllib_request

import jwt
from flask import current_app, jsonify, request, session
from supabase import create_client
from werkzeug.security import check_password_hash, generate_password_hash

from backend import db
from backend.auth import auth_bp
from backend.models import AppealTicket, Comment, Follow, Like, OTPCode, Post, Report, User


logger = logging.getLogger(__name__)


def effective_user_role(user):
    """Return the role used by API consumers when legacy fields disagree."""
    if bool(user.is_admin) or user.role == "admin":
        return "admin"
    return user.role if user.role in {"moderator", "user"} else "user"


def make_token(user):
    return jwt.encode(
        {"user_id": user.id, "username": user.username,
         "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=7)},
        current_app.config["SECRET_KEY"], algorithm="HS256"
    )


def token_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return jsonify({"message": "Token is missing"}), 401
        try:
            payload = jwt.decode(
                authorization[7:].strip(), current_app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )
            user = db.session.get(User, payload["user_id"])
            if not user or not user.active:
                raise jwt.InvalidTokenError
        except (jwt.InvalidTokenError, KeyError, ValueError):
            return jsonify({"message": "Token is invalid or expired"}), 401
        return function(user, *args, **kwargs)
    return decorated


def optional_token(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        if not authorization:
            return function(None, *args, **kwargs)
        if not authorization.startswith("Bearer "):
            return jsonify({"message": "Token is invalid or expired"}), 401
        try:
            payload = jwt.decode(
                authorization[7:].strip(), current_app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )
            user = db.session.get(User, payload["user_id"])
            if not user or not user.active:
                raise jwt.InvalidTokenError
        except (jwt.InvalidTokenError, KeyError, ValueError):
            return jsonify({"message": "Token is invalid or expired"}), 401
        return function(user, *args, **kwargs)
    return decorated


def send_otp_via_sendgrid(to_email, otp_code):
    api_key = os.getenv("SENDGRID_API_KEY")
    sender = os.getenv("MAIL_DEFAULT_SENDER", "kaiyaowu3@gmail.com")
    if not api_key:
        logger.error("[SENDGRID ERROR] SENDGRID_API_KEY is not configured")
        return False

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": sender},
        "subject": "Your Aero Verification Code",
        "content": [{
            "type": "text/html",
            "value": (
                "<html><body>"
                "<p>Your Aero verification code is:</p>"
                f'<p><strong style="font-size: 24px;">{otp_code}</strong></p>'
                "<p>This code expires in 10 minutes. Please do not share it with anyone.</p>"
                "</body></html>"
            ),
        }],
    }
    request = urllib_request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            status_code = response.getcode()
        if status_code in (200, 202):
            logger.info("[SENDGRID SUCCESS] OTP email sent to %s", to_email)
            return True
        logger.error("[SENDGRID ERROR] Unexpected HTTP status %s for %s", status_code, to_email)
    except urllib_error.HTTPError as error:
        logger.error("[SENDGRID ERROR] HTTP %s while sending OTP to %s: %s", error.code, to_email, error.reason)
    except Exception as error:
        logger.error("[SENDGRID ERROR] Failed to send OTP to %s: %s", to_email, error)
        return False
    return False


def issue_otp(email, commit=True):
    code = f"{secrets.randbelow(900000) + 100000}"
    otp = db.session.get(OTPCode, email) or OTPCode(email=email)
    otp.code_hash = generate_password_hash(code)
    otp.expires_at = dt.datetime.utcnow() + dt.timedelta(minutes=10)
    otp.attempts = 0
    db.session.add(otp)
    if commit:
        db.session.commit()
    return send_otp_via_sendgrid(email, code)


@auth_bp.get("/test")
def auth_test():
    return jsonify({"message": "Authentication Blueprint is working!"})


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", data.get("confirmPassword", password)))
    if len(username) < 3 or len(username) > 30 or not re.fullmatch(r"[A-Za-z0-9_ ]+", username):
        return jsonify({"message": "Username must be 3-30 letters, numbers, underscores, or spaces"}), 400
    if "@" not in email or len(email) > 254:
        return jsonify({"message": "Invalid email address"}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"message": "Password must be 8-128 characters"}), 400
    if (not any(char.isupper() for char in password) or
            not any(char.isdigit() for char in password) or
            not any(not char.isalnum() for char in password)):
        return jsonify({"message": "Password must include uppercase, number, and special character"}), 400
    if password != confirm_password:
        return jsonify({"message": "Passwords do not match"}), 400

    user = None
    try:
        existing = User.query.filter((User.username.ilike(username)) | (User.email.ilike(email))).first()
        if existing and (existing.ban_count or 0) >= 3:
            return jsonify({"message": "This account is permanently banned and cannot be registered again"}), 403
        if existing and existing.active:
            return jsonify({"message": "Username or email is already registered"}), 409
        user = existing or User(username=username, email=email, active=False)
        user.username = username
        user.email = email
        user.active = False
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        issue_otp(email, commit=False)
        db.session.commit()
        return jsonify({"message": "Verification code generated. Check your email if delivery succeeds."}), 200
    except RuntimeError as error:
        db.session.rollback()
        db.session.query(OTPCode).filter_by(email=email).delete()
        db.session.commit()
        return jsonify({"message": str(error)}), 502
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to create account right now"}), 500


@auth_bp.post("/resend-otp")
def resend_otp():
    email = str((request.get_json(silent=True) or {}).get("email", "")).strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or user.active:
        return jsonify({"message": "Invalid verification code request"}), 400
    issue_otp(email)
    return jsonify({"message": "A new verification code was generated. Check your email if delivery succeeds."}), 200


@auth_bp.post("/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    code = str(data.get("code", "")).strip()
    otp = db.session.get(OTPCode, email)
    if not otp or otp.attempts >= 5 or otp.expires_at < dt.datetime.utcnow():
        return jsonify({"message": "Invalid or expired verification code"}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(otp.code_hash, code):
        otp.attempts += 1
        db.session.commit()
        return jsonify({"message": "Invalid or expired verification code"}), 400
    user.active = True
    db.session.delete(otp)
    db.session.commit()
    session["user_id"] = user.id
    role = effective_user_role(user)
    return jsonify({"token": make_token(user), "user": {
        "id": user.id, "username": user.username, "display_name": user.display_name or user.username, "email": user.email,
        "bio": user.bio or "", "avatar_url": user.avatar_url or "",
        "language_preference": user.language_preference,
        "role": role,
        "is_moderator": role == "moderator",
        "is_admin": role == "admin", "is_banned": user.is_banned,
        "is_private": user.is_private, "show_online_status": user.show_online_status,
    }}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    identifier = str(data.get("identifier", data.get("email", data.get("username", "")))).strip()
    user = User.query.filter((User.email.ilike(identifier.lower())) | (User.username.ilike(identifier))).first()
    if not user or not user.active:
        return jsonify({"message": "If the account exists, a reset code has been sent"}), 200
    session["password_reset_email"] = user.email
    issue_otp(user.email)
    return jsonify({"message": "Reset code sent"}), 200


@auth_bp.post("/verify-reset-otp")
def verify_reset_otp():
    code = str((request.get_json(silent=True) or {}).get("code", "")).strip()
    email = session.get("password_reset_email")
    otp = db.session.get(OTPCode, email) if email else None
    if not otp or otp.attempts >= 5 or otp.expires_at < dt.datetime.utcnow() or not check_password_hash(otp.code_hash, code):
        if otp:
            otp.attempts += 1
            db.session.commit()
        return jsonify({"message": "Invalid or expired verification code"}), 400
    return jsonify({"message": "Code verified"}), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", session.get("password_reset_email", ""))).strip().lower()
    code = str(data.get("code", data.get("otp", data.get("token", "")))).strip()
    new_password = str(data.get("new_password", data.get("password", "")))
    otp = db.session.get(OTPCode, email) if email else None
    if not otp or otp.attempts >= 5 or otp.expires_at < dt.datetime.utcnow() or not check_password_hash(otp.code_hash, code):
        return jsonify({"message": "Invalid or expired verification code"}), 400
    if len(new_password) < 8 or len(new_password) > 128:
        return jsonify({"message": "Password must be 8-128 characters"}), 400
    if (not any(char.isupper() for char in new_password) or
            not any(char.isdigit() for char in new_password) or
            not any(not char.isalnum() for char in new_password)):
        return jsonify({"message": "Password must include uppercase, number, and special character"}), 400
    user = User.query.filter_by(email=email).first()
    if user and ((user.ban_count or 0) >= 3 or user.is_banned):
        return jsonify({"message": "This account is suspended"}), 403
    if not user:
        session.pop("password_reset_email", None)
        return jsonify({"message": "Account not found"}), 404
    user.set_password(new_password)
    db.session.delete(otp)
    db.session.commit()
    session.pop("password_reset_email", None)
    return jsonify({"message": "Password reset successfully"}), 200


@auth_bp.post("/signin")
def signin():
    data = request.get_json(silent=True) or {}
    user = User.query.filter_by(username=str(data.get("username", "")).strip()).first()
    if not user or not user.check_password(str(data.get("password", ""))):
        return jsonify({"message": "Incorrect username or password"}), 401
    if not user.active:
        return jsonify({"message": "Account has not been activated by email"}), 403
    if (user.ban_count or 0) >= 3:
        return jsonify({"message": "Your account has been permanently banned after reaching the maximum number of bans", "suspended": True, "permanent": True, "username": user.username}), 403
    if user.is_banned:
        return jsonify({"message": "Account suspended", "suspended": True, "username": user.username}), 403
    session["user_id"] = user.id
    role = effective_user_role(user)
    return jsonify({"token": make_token(user), "user": {
        "id": user.id, "username": user.username, "display_name": user.display_name or user.username, "email": user.email,
        "bio": user.bio or "", "avatar_url": user.avatar_url or "",
        "language_preference": user.language_preference,
        "role": role,
        "is_moderator": role == "moderator",
        "is_admin": role == "admin", "is_banned": user.is_banned,
        "is_private": user.is_private, "show_online_status": user.show_online_status,
    }}), 200


@auth_bp.post("/supabase")
def supabase_signin():
    access_token = str((request.get_json(silent=True) or {}).get("access_token", "")).strip()
    if not access_token:
        return jsonify({"message": "Supabase access token is required"}), 400

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        return jsonify({"message": "Supabase authentication is not configured"}), 503
    try:
        auth_response = create_client(supabase_url, supabase_key).auth.get_user(access_token)
        supabase_user = getattr(auth_response, "user", None)
    except Exception:
        return jsonify({"message": "Supabase session is invalid or expired"}), 401
    if not supabase_user or not supabase_user.email:
        return jsonify({"message": "The social account did not provide an email address"}), 400

    metadata = supabase_user.user_metadata or {}
    email = str(supabase_user.email).strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        raw_name = str(metadata.get("user_name") or metadata.get("preferred_username") or metadata.get("name") or email.split("@", 1)[0])
        username = re.sub(r"[^A-Za-z0-9_ ]", "", raw_name).strip()[:30] or "Aero User"
        while User.query.filter_by(username=username).first():
            suffix = secrets.token_hex(2)
            username = f"{username[:25].rstrip()}_{suffix}"[:30]
        user = User(username=username, email=email, active=True, display_name=str(metadata.get("full_name") or metadata.get("name") or username)[:80])
        user.set_password(secrets.token_urlsafe(32))
        db.session.add(user)
    user.active = True
    avatar_url = metadata.get("avatar_url") or metadata.get("picture")
    if avatar_url and not user.avatar_url:
        user.avatar_url = str(avatar_url)[:500]
    db.session.commit()
    session["user_id"] = user.id
    role = effective_user_role(user)
    return jsonify({"token": make_token(user), "user": {
        "id": user.id, "username": user.username, "display_name": user.display_name or user.username, "email": user.email,
        "bio": user.bio or "", "avatar_url": user.avatar_url or "", "role": role,
        "language_preference": user.language_preference,
        "is_moderator": role == "moderator", "is_admin": role == "admin", "is_banned": user.is_banned,
        "is_private": user.is_private, "show_online_status": user.show_online_status,
    }}), 200


@auth_bp.post("/appeals")
def submit_appeal():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    content = str(data.get("content", "")).strip()
    user = User.query.filter(User.username.ilike(username)).first()
    if not user or not user.is_banned or not content or len(content) > 2000:
        return jsonify({"message": "A banned username and appeal text are required"}), 400
    if (user.ban_count or 0) >= 3:
        return jsonify({"message": "Appeals are unavailable because this account is permanently banned"}), 403
    db.session.add(AppealTicket(user_id=user.id, content=content))
    db.session.commit()
    return jsonify({"message": "Appeal submitted"}), 201


@auth_bp.put("/password")
@token_required
def change_password(current_user):
    data = request.get_json(silent=True) or {}
    old_password = str(data.get("old_password", ""))
    new_password = str(data.get("new_password", ""))
    if not current_user.check_password(old_password):
        return jsonify({"message": "Current password is incorrect"}), 400
    if len(new_password) < 8 or len(new_password) > 128:
        return jsonify({"message": "Password must be 8-128 characters"}), 400
    if (not any(char.isupper() for char in new_password) or
            not any(char.isdigit() for char in new_password) or
            not any(not char.isalnum() for char in new_password)):
        return jsonify({"message": "Password must include uppercase, number, and special character"}), 400
    current_user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"}), 200


@auth_bp.delete("/account")
@token_required
def delete_account(current_user):
    post_ids = [post.id for post in Post.query.filter_by(user_id=current_user.id).all()]
    if post_ids:
        Comment.query.filter(Comment.post_id.in_(post_ids)).delete(synchronize_session=False)
        Like.query.filter(Like.post_id.in_(post_ids)).delete(synchronize_session=False)
        Post.query.filter(Post.id.in_(post_ids)).delete(synchronize_session=False)
    Comment.query.filter_by(user_id=current_user.id).delete(synchronize_session=False)
    Like.query.filter_by(user_id=current_user.id).delete(synchronize_session=False)
    Follow.query.filter((Follow.follower_id == current_user.id) | (Follow.following_id == current_user.id)).delete(synchronize_session=False)
    Report.query.filter_by(reporter_id=current_user.id).delete(synchronize_session=False)
    db.session.delete(current_user)
    db.session.commit()
    session.clear()
    return jsonify({"message": "Account deleted successfully"}), 200
