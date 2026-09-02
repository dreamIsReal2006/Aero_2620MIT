import datetime as dt
import os
import secrets
import smtplib
import traceback
from email.mime.text import MIMEText
from functools import wraps

import jwt
from flask import current_app, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from backend import db
from backend.auth import auth_bp
from backend.models import Comment, Follow, Like, OTPCode, Post, Report, User


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


def send_otp_email(receiver_email, otp_code):
    server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    try:
        port = int(os.getenv("MAIL_PORT", "587"))
    except ValueError:
        port = 587
    use_tls = os.getenv("MAIL_USE_TLS", "True").lower() in ("true", "1", "t")
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    sender = os.getenv("MAIL_DEFAULT_SENDER", username)
    if not username:
        username = current_app.config.get("MAIL_USERNAME")
    if not password:
        password = current_app.config.get("MAIL_PASSWORD")
    sender = sender or current_app.config.get("MAIL_DEFAULT_SENDER") or username
    dev_mode = current_app.debug or os.environ.get("AERO_ALLOW_DEBUG_OTP") == "1"
    if not username or not password:
        if dev_mode:
            print(f"[DEV MODE] Registered OTP Code for {receiver_email}: {otp_code}")
            return True
        current_app.logger.error("SMTP is not configured; OTP email was not sent")
        return False
    message = MIMEText(f"Your OTP is: {otp_code}", "plain", "utf-8")
    message["Subject"] = "Verification Code"
    message["From"] = sender
    message["To"] = receiver_email
    try:
        smtp_client = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
        with smtp_client(server, port, timeout=10) as mail_server:
            if use_tls and port != 465:
                mail_server.starttls()
            mail_server.login(username, password)
            mail_server.send_message(message)
        print("[SMTP SUCCESS] OTP email sent to:", receiver_email)
        current_app.logger.info("[SMTP SUCCESS] OTP email sent to %s", receiver_email)
        return True
    except Exception as error:
        print("========== [SMTP ERROR DEBUG] ==========")
        traceback.print_exc()
        print("========================================")
        if isinstance(error, smtplib.SMTPAuthenticationError):
            print("[SMTP ERROR] Authentication failed: check MAIL_PASSWORD is a Gmail App Password.", error)
        else:
            print("[SMTP ERROR] OTP email delivery failed:", str(error))
        current_app.logger.error("[SMTP ERROR] OTP delivery failed: %s", error)
        if dev_mode:
            print(f"[DEV MODE] Registered OTP Code for {receiver_email}: {otp_code}")
            return True
        return False


def issue_otp(email):
    code = f"{secrets.randbelow(900000) + 100000}"
    otp = db.session.get(OTPCode, email) or OTPCode(email=email)
    otp.code_hash = generate_password_hash(code)
    otp.expires_at = dt.datetime.utcnow() + dt.timedelta(minutes=10)
    otp.attempts = 0
    db.session.add(otp)
    db.session.commit()
    return send_otp_email(email, code)


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
    if len(username) < 3 or len(username) > 30 or not username.replace("_", "").isalnum():
        return jsonify({"message": "Username must be 3-30 letters, numbers, or underscores"}), 400
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
        if User.query.filter((User.username.ilike(username)) | (User.email.ilike(email))).first():
            return jsonify({"message": "Username or email is already registered"}), 409
        user = User(username=username, email=email, active=False)
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        if not issue_otp(email):
            raise RuntimeError("OTP email could not be sent. Check SMTP configuration")
        return jsonify({"message": "Verification code sent to your email"}), 200
    except RuntimeError as error:
        db.session.rollback()
        if user and db.session.get(User, user.id):
            db.session.delete(user)
        db.session.commit()
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
    if not issue_otp(email):
        return jsonify({"message": "OTP email could not be sent. Check SMTP configuration"}), 502
    return jsonify({"message": "A new verification code has been sent"}), 200


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
    return jsonify({"token": make_token(user), "user": {
        "id": user.id, "username": user.username, "email": user.email,
        "bio": user.bio or "", "avatar_url": user.avatar_url or "",
        "is_admin": user.is_admin, "is_banned": user.is_banned,
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
    if not issue_otp(user.email):
        session.pop("password_reset_email", None)
        return jsonify({"message": "Reset code could not be sent. Check SMTP configuration"}), 502
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
    email = session.get("password_reset_email")
    code = str(data.get("code", "")).strip()
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
    session["user_id"] = user.id
    return jsonify({"token": make_token(user), "user": {
        "id": user.id, "username": user.username, "email": user.email,
        "bio": user.bio or "", "avatar_url": user.avatar_url or "",
        "is_admin": user.is_admin, "is_banned": user.is_banned,
        "is_private": user.is_private, "show_online_status": user.show_online_status,
    }}), 200


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
