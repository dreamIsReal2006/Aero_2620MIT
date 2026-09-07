import os
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

db = SQLAlchemy()


def create_app():
    base_dir = Path(__file__).resolve().parent.parent

    app = Flask(
        __name__,
        static_folder=str(base_dir),
        static_url_path="",
    )

    @app.before_request
    def block_legacy_admin_page():
        if request.path in {"/admin", "/admin.html"}:
            abort(404)

    app.config["SECRET_KEY"] = os.environ.get(
        "AERO_SECRET_KEY",
        "development-only-change-this-secret",
    )

    database_setting = os.environ.get(
        "AERO_DATABASE",
        str(base_dir / "aero.db"),
    )

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        database_setting
        if "://" in database_setting
        else f"sqlite:///{database_setting}"
    )

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # File upload limit
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024

    # Mail configuration
    app.config["MAIL_SERVER"] = os.environ.get(
        "AERO_MAIL_SERVER",
        "smtp.gmail.com",
    )

    app.config["MAIL_PORT"] = int(
        os.environ.get("AERO_MAIL_PORT", "587")
    )

    app.config["MAIL_USERNAME"] = os.environ.get(
        "AERO_MAIL_USERNAME"
    )

    app.config["MAIL_PASSWORD"] = os.environ.get(
        "AERO_MAIL_PASSWORD"
    )

    app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
        "AERO_MAIL_DEFAULT_SENDER",
        app.config["MAIL_USERNAME"],
    )

    # Upload folder
    app.config["UPLOAD_FOLDER"] = os.environ.get(
        "AERO_UPLOAD_DIR",
        str(base_dir / "uploads"),
    )

    Path(app.config["UPLOAD_FOLDER"]).mkdir(
        parents=True,
        exist_ok=True,
    )

    # CORS
    CORS(
        app,
        origins=os.environ.get(
            "AERO_ALLOWED_ORIGINS",
            "*",
        ).split(","),
    )

    db.init_app(app)

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
    )

    # Authentication
    from backend.auth import auth_bp
    from backend.auth import routes as auth_routes

    # Feed
    from backend.feed import feed_bp
    from backend.feed import routes as feed_routes

    # Interactions
    from backend.interact import interact_bp
    from backend.interact import routes as interact_routes

    # Social
    from backend.social import social_bp
    from backend.social import routes as social_routes

    # Messaging
    from backend.messages import messages_bp
    import backend.messages.routes

    # Video
    from backend.video import video_bp
    from backend.video import routes as video_routes

    # Chat
    from backend.chat import chat_bp
    from backend.chat import routes as chat_routes

    # Notifications
    from backend.notification import notification_bp
    from backend.notification import routes as notification_routes

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(feed_bp)
    app.register_blueprint(interact_bp)
    app.register_blueprint(social_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(notification_bp)

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            "success": False,
            "message": "Uploaded file exceeds the 500MB limit"
        }), 413

    @app.errorhandler(401)
    def authentication_required(error):
        return jsonify({
            "success": False,
            "error": "Authentication required"
        }), 401

    @app.errorhandler(403)
    def authorization_required(error):
        return jsonify({
            "success": False,
            "error": "Administrator access required"
        }), 403

    with app.app_context():
        db.create_all()

        if db.engine.dialect.name == "sqlite":

            # -------------------------
            # Posts
            # -------------------------
            post_columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(posts)")
                )
            }

            if "parent_id" not in post_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE posts ADD COLUMN parent_id INTEGER"
                    )
                )

            if "type" not in post_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE posts ADD COLUMN "
                        "type VARCHAR(12) NOT NULL DEFAULT 'original'"
                    )
                )

            # -------------------------
            # Users
            # -------------------------
            columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(users)")
                )
            }

            if "is_admin" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "is_admin BOOLEAN NOT NULL DEFAULT 0"
                    )
                )

            if "is_banned" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "is_banned BOOLEAN NOT NULL DEFAULT 0"
                    )
                )

            if "role" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "role VARCHAR(20) NOT NULL DEFAULT 'user'"
                    )
                )

            if "display_name" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "display_name VARCHAR(80) NOT NULL DEFAULT ''"
                    )
                )

            if "bio" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "bio VARCHAR(150) NOT NULL DEFAULT ''"
                    )
                )

            if "avatar_url" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "avatar_url VARCHAR(500) NOT NULL DEFAULT ''"
                    )
                )

            if "is_private" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "is_private BOOLEAN NOT NULL DEFAULT 0"
                    )
                )

            if "show_online_status" not in columns:
                db.session.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN "
                        "show_online_status BOOLEAN NOT NULL DEFAULT 1"
                    )
                )

            for column_name in (
                "push_notifications",
                "notify_likes",
                "notify_comments",
            ):
                if column_name not in columns:
                    db.session.execute(
                        text(
                            f"ALTER TABLE users ADD COLUMN "
                            f"{column_name} BOOLEAN NOT NULL DEFAULT 1"
                        )
                    )

            # -------------------------
            # Follows
            # -------------------------
            follow_columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(follows)")
                )
            }

            if "status" not in follow_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE follows ADD COLUMN "
                        "status VARCHAR(20) NOT NULL DEFAULT 'approved'"
                    )
                )

            # -------------------------
            # Comments
            # -------------------------
            comment_columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(comments)")
                )
            }

            if "image_url" not in comment_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE comments ADD COLUMN "
                        "image_url VARCHAR(500) NOT NULL DEFAULT ''"
                    )
                )

            # -------------------------
            # Messages
            # -------------------------
            message_columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(messages)")
                )
            }

            if "media_url" not in message_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE messages ADD COLUMN "
                        "media_url VARCHAR(500) NOT NULL DEFAULT ''"
                    )
                )

            if "type" not in message_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE messages ADD COLUMN "
                        "type VARCHAR(20) NOT NULL DEFAULT 'text'"
                    )
                )

            # -------------------------
            # Video comments
            # -------------------------
            video_comment_columns = {
                column[1]
                for column in db.session.execute(
                    text("PRAGMA table_info(video_comments)")
                )
            }

            if "media_url" not in video_comment_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE video_comments ADD COLUMN "
                        "media_url VARCHAR(500) NOT NULL DEFAULT ''"
                    )
                )

            if "type" not in video_comment_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE video_comments ADD COLUMN "
                        "type VARCHAR(20) NOT NULL DEFAULT 'text'"
                    )
                )

            db.session.commit()

    # -------------------------
    # Admin
    # -------------------------
    from backend.admin import admin_bp
    from backend.admin import routes as admin_routes
    from backend.admin.decorators import admin_required, login_required

    app.register_blueprint(admin_bp)

    admin_secret_path = (
        os.environ.get(
            "ADMIN_SECRET_PATH",
            "default_fallback",
        ).strip()
        or "default_fallback"
    )

    admin_page_path = f"/admin_{admin_secret_path}"

    @app.get(admin_page_path)
    @login_required
    @admin_required
    def admin_dashboard():
        return send_from_directory(
            base_dir,
            "admin.html",
        )

    @app.get("/api/admin-entry")
    @login_required
    @admin_required
    def admin_entry():
        return jsonify({
            "url": admin_page_path
        }), 200

    return app
