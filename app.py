import datetime as dt
import json
import os
import secrets
import smtplib
import sqlite3
import uuid
from contextlib import contextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps
from pathlib import Path

import jwt
from flask import Flask, jsonify, render_template_string, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent

DATABASE_PATH = Path(os.environ.get("AERO_DATABASE", BASE_DIR / "aero.db"))
UPLOAD_DIR = Path(os.environ.get("AERO_UPLOAD_DIR", BASE_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "kaiyaowu3@gmail.com"
app.config["MAIL_PASSWORD"] = "hxqr ryjl srdz wulv"
app.config["MAIL_DEFAULT_SENDER"] = "kaiyaowu3@gmail.com"
CORS(
    app,
    origins=os.environ.get(
        "AERO_ALLOWED_ORIGINS", "*"
    ).split(","),
)

SECRET_KEY = os.environ.get("AERO_SECRET_KEY", "development-only-change-this-secret")
SMTP_SERVER = app.config["MAIL_SERVER"]
SMTP_PORT = app.config["MAIL_PORT"]
SENDER_EMAIL = app.config["MAIL_USERNAME"]
SENDER_PASSWORD = app.config["MAIL_PASSWORD"]
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}


@app.get("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/profile/<username>")
def profile_page(username):
    with get_db() as connection:
        user = connection.execute(
            "SELECT id, username, email, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not user:
        return jsonify({"message": "User not found"}), 404
    return render_template_string("""
        <!doctype html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>{{ username }} | Aero</title></head>
        <body>
            <h1>Profile: {{ username }}</h1>
            <p>Email: {{ email }}</p>
            <p>Joined: {{ created_at }}</p>
        </body>
        </html>
    """, username=user["username"], email=user["email"], created_at=user["created_at"])


@app.route("/post/<post_id>")
@app.route("/post/<int:post_id>")
def post_detail_page(post_id):
    post_key = str(post_id)
    with get_db() as connection:
        row = connection.execute(
            "SELECT posts.id, posts.content, posts.created_at, users.username FROM posts JOIN users ON users.id = posts.user_id WHERE posts.id = ?",
            (post_key,),
        ).fetchone()
    if not row:
        return jsonify({"message": "Post not found"}), 404
    return render_template_string("""
        <!doctype html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Post {{ post_id }} | Aero</title></head>
        <body>
            <h1>Post by {{ username }}</h1>
            <p>{{ content }}</p>
            <p>Created: {{ created_at }}</p>
        </body>
        </html>
    """, post_id=row["id"], username=row["username"], content=row["content"], created_at=row["created_at"])


@app.route("/search")
def search_page():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:filename>")
def frontend_file(filename):
    requested_file = BASE_DIR / filename
    if requested_file.is_file() and BASE_DIR in requested_file.resolve().parents:
        return send_from_directory(BASE_DIR, filename)
    return jsonify({"message": "Not found"}), 404


@contextmanager
def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def init_db():
    with get_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS otp_codes (
                email TEXT PRIMARY KEY COLLATE NOCASE,
                code_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                images_json TEXT NOT NULL DEFAULT '[]',
                likes INTEGER NOT NULL DEFAULT 0,
                comments INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def send_otp_email(receiver_email, otp_code):
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        app.logger.error(
            "SMTP is not configured: SENDER_EMAIL and SENDER_PASSWORD are required; "
            "OTP email was not sent"
        )
        return False
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "Aero email verification"
        message["From"] = f"Aero Social <{app.config['MAIL_DEFAULT_SENDER']}>"
        message["To"] = receiver_email
        message.attach(MIMEText(f"Your Aero verification code is {otp_code}. It expires in 10 minutes.", "plain"))

        smtp_client = smtplib.SMTP_SSL if SMTP_PORT == 465 else smtplib.SMTP
        with smtp_client(SMTP_SERVER, SMTP_PORT, timeout=30) as server:
            if SMTP_PORT != 465:
                server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            refused_recipients = server.sendmail(
                app.config["MAIL_DEFAULT_SENDER"],
                [receiver_email],
                message.as_string(),
            )
            if refused_recipients:
                app.logger.error(
                    "SMTP rejected OTP recipient(s): %s",
                    refused_recipients,
                )
                return False
        return True
    except (OSError, smtplib.SMTPException) as error:
        app.logger.error(
            "SMTP delivery failed for %s via %s:%s: %s",
            receiver_email,
            SMTP_SERVER,
            SMTP_PORT,
            error,
            exc_info=True,
        )
        return False


def issue_otp(email):
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10)).isoformat()
    with get_db() as connection:
        connection.execute(
            "INSERT INTO otp_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0) "
            "ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0",
            (email, generate_password_hash(code), expires_at),
        )
    return send_otp_email(email, code)


def row_to_post(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "content": row["content"],
        "images": json.loads(row["images_json"]),
        "likes": row["likes"],
        "comments": row["comments"],
        "created_at": row["created_at"],
    }


def token_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return jsonify({"message": "Token is missing"}), 401
        try:
            payload = jwt.decode(authorization[7:].strip(), SECRET_KEY, algorithms=["HS256"])
            with get_db() as connection:
                user = connection.execute(
                    "SELECT id, username, email, active FROM users WHERE username = ?", (payload["username"],)
                ).fetchone()
            if not user or not user["active"]:
                raise jwt.InvalidTokenError
        except (jwt.InvalidTokenError, KeyError, ValueError):
            return jsonify({"message": "Token is invalid or expired"}), 401
        return function(dict(user), *args, **kwargs)
    return decorated


def make_token(username):
    return jwt.encode(
        {"username": username, "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=7)},
        SECRET_KEY,
        algorithm="HS256",
    )


@app.post("/api/auth/signup")
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
    try:
        with get_db() as connection:
            connection.execute(
                "INSERT INTO users (username, email, password_hash, active, created_at) VALUES (?, ?, ?, 0, ?)",
                (username, email, generate_password_hash(password), now_iso()),
            )
    except sqlite3.IntegrityError:
        return jsonify({"message": "Username or email is already registered"}), 409
    if not issue_otp(email):
        return jsonify({"message": "OTP email could not be sent. Check the server SMTP logs and try again later"}), 502
    return jsonify({"message": "Verification code sent to your email"}), 200


@app.post("/api/auth/resend-otp")
def resend_otp():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    with get_db() as connection:
        user = connection.execute("SELECT active FROM users WHERE email = ?", (email,)).fetchone()
    if not user or user["active"]:
        return jsonify({"message": "Invalid verification code request"}), 400
    if not issue_otp(email):
        return jsonify({"message": "OTP email could not be sent. Check the server SMTP logs and try again later"}), 502
    return jsonify({"message": "A new verification code has been sent"}), 200


@app.post("/api/auth/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    code = str(data.get("code", "")).strip()
    with get_db() as connection:
        otp = connection.execute("SELECT * FROM otp_codes WHERE email = ?", (email,)).fetchone()
        if not otp or otp["attempts"] >= 5 or dt.datetime.fromisoformat(otp["expires_at"]) < dt.datetime.now(dt.timezone.utc):
            return jsonify({"message": "Invalid or expired verification code"}), 400
        if not check_password_hash(otp["code_hash"], code):
            connection.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?", (email,))
            return jsonify({"message": "Invalid or expired verification code"}), 400
        connection.execute("UPDATE users SET active = 1 WHERE email = ?", (email,))
        user = connection.execute("SELECT username, email FROM users WHERE email = ?", (email,)).fetchone()
        connection.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
    return jsonify({"token": make_token(user["username"]), "user": dict(user)}), 200


@app.post("/api/auth/signin")
def signin():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    with get_db() as connection:
        user = connection.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"message": "Incorrect username or password"}), 401
    if not user["active"]:
        return jsonify({"message": "Account has not been activated by email"}), 403
    return jsonify({"token": make_token(username), "user": {"username": username, "email": user["email"]}}), 200


@app.get("/api/search")
def search():
    query = str(request.args.get("q", "")).strip()
    if not query:
        return jsonify({"users": [], "posts": []}), 200

    like_pattern = f"%{query}%"
    with get_db() as connection:
        users = connection.execute(
            "SELECT id, username, email FROM users WHERE LOWER(username) LIKE LOWER(?) ORDER BY username LIMIT 5",
            (like_pattern,),
        ).fetchall()
        posts = connection.execute(
            "SELECT posts.id, posts.content, users.username FROM posts JOIN users ON users.id = posts.user_id WHERE LOWER(posts.content) LIKE LOWER(?) ORDER BY posts.created_at DESC LIMIT 5",
            (like_pattern,),
        ).fetchall()

    return jsonify({
        "users": [dict(row) for row in users],
        "posts": [dict(row) for row in posts],
    }), 200


@app.get("/api/posts")
@token_required
def get_posts(current_user):
    with get_db() as connection:
        rows = connection.execute(
            "SELECT posts.*, users.username FROM posts JOIN users ON users.id = posts.user_id ORDER BY posts.created_at DESC"
        ).fetchall()
    return jsonify([row_to_post(row) for row in rows]), 200


@app.post("/api/uploads")
@token_required
def upload_media(current_user):
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"message": "Please select an image"}), 400
    extension = Path(secure_filename(file.filename)).suffix.lower().lstrip(".")
    if extension not in ALLOWED_IMAGE_EXTENSIONS or not (file.mimetype or "").startswith("image/"):
        return jsonify({"message": "Only JPG, PNG, GIF, or WEBP images are supported"}), 400
    filename = f"{uuid.uuid4().hex}.{extension}"
    file.save(UPLOAD_DIR / filename)
    return jsonify({"url": f"/uploads/{filename}"}), 201


@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.post("/api/posts")
@token_required
def create_post(current_user):
    data = request.get_json(silent=True) or {}
    content = str(data.get("content", "")).strip()
    images = data.get("images", [])
    if not content or len(content) > 5000 or not isinstance(images, list) or len(images) > 10:
        return jsonify({"message": "Invalid post content or number of media files"}), 400
    post = (str(uuid.uuid4()), current_user["id"], content, json.dumps(images), now_iso())
    with get_db() as connection:
        connection.execute(
            "INSERT INTO posts (id, user_id, content, images_json, created_at) VALUES (?, ?, ?, ?, ?)", post
        )
        row = connection.execute(
            "SELECT posts.*, users.username FROM posts JOIN users ON users.id = posts.user_id WHERE posts.id = ?", (post[0],)
        ).fetchone()
    return jsonify(row_to_post(row)), 201


@app.delete("/api/posts/<post_id>")
@token_required
def delete_post(current_user, post_id):
    with get_db() as connection:
        result = connection.execute("DELETE FROM posts WHERE id = ? AND user_id = ?", (post_id, current_user["id"]))
    if result.rowcount == 0:
        return jsonify({"message": "You are not authorized to delete this post"}), 403
    return jsonify({"message": "Post deleted successfully"}), 200


@app.errorhandler(413)
def request_too_large(error):
    return jsonify({"message": "Uploaded files cannot exceed 10 MB"}), 413


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
