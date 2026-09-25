import logging
import os
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text


logger = logging.getLogger(__name__)

db = SQLAlchemy()  # creates database object


def create_app():
    base_dir = Path(__file__).resolve().parent.parent
    app = Flask(
        __name__,
        static_folder=str(base_dir),
        static_url_path="",
    )

    app.config["SECRET_KEY"] = os.environ.get(
        "AERO_SECRET_KEY", "development-only-change-this-secret"
    )
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024
    database_uri = os.environ.get(
        "DATABASE_URL",
        os.environ.get(
            "AERO_DATABASE",
            "postgresql://postgres.tamzlrygqskxscofwnho:KaiYao0694%40@"
            "aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
        ),
    )
    if not database_uri.startswith(("postgresql://", "postgresql+")):
        raise RuntimeError("DATABASE_URL must point to the Supabase PostgreSQL database")
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
    required_origins = [
        "https://aero-group4.netlify.app",
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

    @app.after_request
    def add_static_cache_headers(response):
        if not request.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "public, max-age=3600")
        return response

    @app.get("/api/ping")
    def ping():
        return jsonify({"status": "ok"})

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

    try:
        with app.app_context():
            db.session.execute(text("SELECT 1"))
            db.create_all()
            db.session.execute(text(
                "UPDATE users SET role = 'admin' "
                "WHERE is_admin IS TRUE AND role <> 'admin'"
            ))
            db.session.execute(text(
                "UPDATE users SET is_admin = TRUE "
                "WHERE role = 'admin' AND is_admin IS NOT TRUE"
            ))
            db.session.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_messages_conversation "
                "ON messages (sender_id, recipient_id, created_at DESC)"
            ))
            db.session.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_messages_reverse_conversation "
                "ON messages (recipient_id, sender_id, created_at DESC)"
            ))
            db.session.commit()
    except Exception:
        logger.error(
            "Supabase PostgreSQL connection or schema initialization failed",
            exc_info=True,
        )
        raise

    from backend.admin import admin_bp
    from backend.admin import routes as admin_routes
    from backend.admin.decorators import login_required, require_role
    app.register_blueprint(admin_bp)

    @app.get("/admin")
    @app.get("/admin.html")
    def admin_dashboard():
        return send_from_directory(base_dir, "admin.html")

    @app.get("/api/admin-entry")
    @login_required
    @require_role(["admin", "moderator"])
    def admin_entry():
        return jsonify({"url": f"admin.html#{'admin' if g.current_user.is_admin or g.current_user.role == 'admin' else 'moderator'}", "api_base": "/api/admin"}), 200

    return app
