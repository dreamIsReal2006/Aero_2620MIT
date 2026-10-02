# Flask application factory, database setup, and shared static routes
# From: app.py/main.py -> To: SQLAlchemy, blueprints, and browser assets
import logging
import os
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text


logger = logging.getLogger(__name__)

db = SQLAlchemy()  # creates database object


def initialize_database(app):
    """Run optional schema maintenance outside the web server startup path."""
    with app.app_context():
        db.session.execute(text("SELECT 1"))
        db.create_all()
        try:
            db.session.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(2)"
            ))
            db.session.commit()
        except Exception as error:
            db.session.rollback()
            logger.warning("Skipping language_preference column check/alter: %s", error)
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


def create_app():
    base_dir = Path(__file__).resolve().parent.parent
    # Serve browser assets from the standardized static directory.
    static_dir = base_dir / "static"
    app = Flask(
        __name__,
        static_folder=str(static_dir),
        static_url_path="/static",
        template_folder=str(base_dir),
    )

    secret_key = os.environ.get("AERO_SECRET_KEY", "").strip()
    if len(secret_key) < 32:
        raise RuntimeError("AERO_SECRET_KEY must be configured and at least 32 characters long")
    app.config["SECRET_KEY"] = secret_key
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
        "http://localhost:3000",
        "http://localhost:8765",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8765",
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

    @app.get("/css/<path:filename>")
    def serve_css(filename):
        return send_from_directory(static_dir / "css", filename)

    @app.get("/js/<path:filename>")
    def serve_js(filename):
        return send_from_directory(static_dir / "js", filename)

    @app.get("/assets/<path:filename>")
    def serve_assets(filename):
        # Preserve legacy asset URLs during the directory migration.
        return send_from_directory(static_dir / "assets", filename)

    @app.get("/index.html")
    @app.get("/otp.html")
    @app.get("/settings.html")
    @app.get("/suspended.html")
    def serve_public_document():
        return send_from_directory(base_dir, request.path.lstrip("/"))

    @app.get("/api/ping")
    def ping():
        return jsonify({"status": "ok"})

    from backend.models import (
        User,
        Post,
        PostVote,
        Comment,
        Follow,
        Like,
        Report,
        UserInteraction,
        Notification,
        CommentLike,
        Video,
        Message,
        ChatEmailCooldown,
        UserCustomGif,
        MediaProcessingJob,
        VideoComment,
        VideoCommentLike,
        Note,
        VideoLike,
        ModerationLog,
        AppealTicket,
        Mute,
        ChatGroup,
        ChatGroupMember,
        Hashtag,
        PostHashtag,
        UserHashtagInterest,
    )

    hashtag_tables = [
        db.metadata.tables[name]
        for name in ("hashtags", "post_hashtags", "user_hashtag_interests")
    ]
    with app.app_context():
        try:
            db.session.execute(text("SET LOCAL statement_timeout = '3s'"))
            db.session.execute(text(
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS poll_json TEXT"
            ))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_access_token TEXT"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_token_expires_at TIMESTAMP NULL"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_page_id VARCHAR(100) NULL"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT NULL"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_account_id VARCHAR(100) NULL"))
            db.session.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP NULL"))
            db.session.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS reply_permission VARCHAR(20) NOT NULL DEFAULT 'anyone'"))
            db.session.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_replies BOOLEAN NOT NULL DEFAULT FALSE"))
            db.session.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS crosspost_targets_json TEXT NOT NULL DEFAULT '[]'"))
            db.session.commit()
        except Exception as error:
            db.session.rollback()
            logger.warning(
                "Skipping poll_json column migration during app startup: %s",
                error,
            )
        try:
            db.metadata.create_all(
                bind=db.engine,
                tables=[
                    db.metadata.tables["post_votes"],
                    db.metadata.tables["chat_email_cooldowns"],
                    db.metadata.tables["user_custom_gifs"],
                    db.metadata.tables["media_processing_jobs"],
                    db.metadata.tables["video_comment_likes"],
                ],
            )
            existing_tables = set(inspect(db.engine).get_table_names())
            if not {table.name for table in hashtag_tables}.issubset(existing_tables):
                db.metadata.create_all(bind=db.engine, tables=hashtag_tables)
        except Exception as error:
            db.session.rollback()
            logger.warning(
                "Skipping optional table creation during app startup: %s",
                error,
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
