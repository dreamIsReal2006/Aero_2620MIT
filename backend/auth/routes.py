import datetime as dt
import os
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps

import jwt
from flask import current_app, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from backend import db
from backend.auth import auth_bp
from backend.models import OTPCode, User


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
    username = current_app.config.get("MAIL_USERNAME")
    password = current_app.config.get("MAIL_PASSWORD")
    if not username or not password:
        if os.environ.get("AERO_ALLOW_DEBUG_OTP") == "1":
            current_app.logger.warning("Debug OTP for %s: %s", receiver_email, otp_code)
            return True
        current_app.logger.error("SMTP is not configured; OTP email was not sent")
        return False
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "Aero email verification"
        message["From"] = current_app.config.get("MAIL_DEFAULT_SENDER", username)
        message["To"] = receiver_email
        message.attach(MIMEText(
            f"Your Aero verification code is {otp_code}. It expires in 10 minutes.",
            "plain"
        ))
        port = int(current_app.config.get("MAIL_PORT", 587))
        with smtplib.SMTP(current_app.config["MAIL_SERVER"], port, timeout=30) as client:
            client.starttls()
            client.login(username, password)
            refused = client.sendmail(message["From"], [receiver_email], message.as_string())
        return not refused
    except (OSError, smtplib.SMTPException) as error:
        current_app.logger.error("SMTP delivery failed: %s", error)
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
    if len(username) < 3 or len(username) > 30 or not username.replace("_", "").isalnum():
        return jsonify({"message": "Username must be 3-30 letters, numbers, or underscores"}), 400
    if "@" not in email or len(email) > 254:
        return jsonify({"message": "Invalid email address"}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"message": "Password must be 8-128 characters"}), 400
    if User.query.filter((User.username.ilike(username)) | (User.email.ilike(email))).first():
        return jsonify({"message": "Username or email is already registered"}), 409
    user = User(username=username, email=email, active=False)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    if not issue_otp(email):
        return jsonify({"message": "OTP email could not be sent. Check SMTP configuration"}), 502
    return jsonify({"message": "Verification code sent to your email"}), 200


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
        "is_admin": user.is_admin, "is_banned": user.is_banned,
    }}), 200


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
        "is_admin": user.is_admin, "is_banned": user.is_banned,
    }}), 200
