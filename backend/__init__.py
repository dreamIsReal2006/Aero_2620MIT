import os
from pathlib import Path

from flask import Flask, abort, g, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

db = SQLAlchemy()  # creates database object


def create_app():
    base_dir = Path(__file__).resolve().parent.parent
    app = Flask(
        __name__,
        static_folder=str(base_dir),
        static_url_path="",
    )

    @app.before_request
    def block_legacy_admin_page():
        if request.method != "OPTIONS" and request.path in {"/admin", "/admin.html"}:
            abort(404)

    app.config["SECRET_KEY"] = os.environ.get(
        "AERO_SECRET_KEY", "development-only-change-this-secret"
    )
    database_uri = os.environ.get(
        "AERO_DATABASE",
        "postgresql://postgres.[REF]:[PASS]@"
        "aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    )
    if database_uri.startswith(("postgresql://", "postgresql+")) and "6543" not in database_uri:
        raise RuntimeError("AERO_DATABASE must use the Supabase transaction pooler on port 6543")
    if database_uri.startswith(("postgresql://", "postgresql+")):
        probe_engine = create_engine(
            database_uri,
            connect_args={"connect_timeout": 3},
        )
        try:
            with probe_engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except OperationalError as error:
            fallback_path = (base_dir / "aero-fallback.db").resolve()
            database_uri = os.environ.get(
                "AERO_DATABASE_FALLBACK",
                f"sqlite:///{fallback_path.as_posix()}",
            )
            app.logger.warning(
                "Supabase PostgreSQL is unavailable; using local fallback database: %s",
                error.__class__.__name__,
            )
        finally:
            probe_engine.dispose()
    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": 10,
    } if database_uri.startswith(("postgresql://", "postgresql+")) else {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
    app.config["MAIL_SERVER"] = os.environ.get("AERO_MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.environ.get("AERO_MAIL_PORT", "587"))
    app.config["MAIL_USERNAME"] = os.environ.get("AERO_MAIL_USERNAME")
    app.config["MAIL_PASSWORD"] = os.environ.get("AERO_MAIL_PASSWORD")
    app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
        "AERO_MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"]
    )
    upload_folder = Path(os.environ.get("AERO_UPLOAD_DIR", "uploads"))
    if not upload_folder.is_absolute():
        upload_folder = base_dir / upload_folder
    app.config["UPLOAD_FOLDER"] = str(upload_folder.resolve())
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    required_origins = [
        "https://aero-g04.netlify.app",
        r"https://.*\.netlify\.app",
        "https://goh.pythonanywhere.com",
    ]
    configured_origins = [
        origin.strip()
        for origin in os.environ.get("AERO_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    CORS(
        app,
        resources={r"/*": {"origins": required_origins + configured_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    db.init_app(app)  # connects SQLAlchemy to Flask

    from backend.models import (
        User,
        Post,
        Comment,
        Follow,
        Like,
        Report,
        UserInteraction,
        Notification,
        CommentLike,
        Video,
        Message,
        VideoComment,
        Note,
        VideoLike,
        ModerationLog,
        AppealTicket,
        Mute,
        ChatGroup,
        ChatGroupMember,
    )

    from backend.auth import auth_bp
    from backend.auth import routes

    app.register_blueprint(auth_bp)

    from backend.interact import interact_bp
    from backend.interact import routes as interact_routes

    app.register_blueprint(interact_bp)
    app.add_url_rule(
        "/api/comments/<int:comment_id>/like",
        endpoint="api_comment_like",
        view_func=interact_routes.toggle_comment_like,
        methods=["POST", "DELETE"],
    )

    from backend.feed import feed_bp
    from backend.feed import routes as feed_routes

    app.register_blueprint(feed_bp)

    from backend.social import social_bp
    from backend.social import routes as social_routes

    app.register_blueprint(social_bp)

    from backend.video import video_bp
    from backend.video import routes as video_routes
    app.register_blueprint(video_bp)

    from backend.chat import chat_bp
    from backend.chat import routes as chat_routes
    app.register_blueprint(chat_bp)

    from backend.messages import messages_bp
    import backend.messages.routes as messages_routes

    app.register_blueprint(messages_bp)

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({"success": False, "message": "Uploaded file exceeds the 500MB limit"}), 413

    @app.errorhandler(401)
    def authentication_required(error):
        return jsonify({"success": False, "error": "Authentication required"}), 401

    @app.errorhandler(403)
    def authorization_required(error):
        return jsonify({"success": False, "error": "Administrator access required"}), 403

    from backend.notification import notification_bp
    from backend.notification import routes as notification_routes

    app.register_blueprint(notification_bp)

    with app.app_context():
        db.session.execute(text("SELECT 1"))
        db.create_all()

    from backend.admin import admin_bp
    from backend.admin import routes as admin_routes
    from backend.admin.decorators import require_role, login_required

    app.register_blueprint(admin_bp)

    admin_page_path = "/admin.html"

    @app.get(admin_page_path)
    @login_required
    @require_role(["admin", "moderator"])
    def admin_dashboard():
        return send_from_directory(base_dir, "admin.html")

    @app.get("/api/admin-entry")
    @login_required
    @require_role(["admin", "moderator"])
    def admin_entry():
        return jsonify({"url": f"admin.html#{'admin' if g.current_user.is_admin or g.current_user.role == 'admin' else 'moderator'}", "api_base": "/api/admin"}), 200

    return app
