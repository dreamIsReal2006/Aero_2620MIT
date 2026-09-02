import os
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

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
    database_setting = os.environ.get("AERO_DATABASE", str(base_dir / "aero.db"))
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        database_setting if "://" in database_setting else f"sqlite:///{database_setting}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
    app.config["MAIL_SERVER"] = os.environ.get("AERO_MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.environ.get("AERO_MAIL_PORT", "587"))
    app.config["MAIL_USERNAME"] = os.environ.get("AERO_MAIL_USERNAME")
    app.config["MAIL_PASSWORD"] = os.environ.get("AERO_MAIL_PASSWORD")
    app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
        "AERO_MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"]
    )
    app.config["UPLOAD_FOLDER"] = os.environ.get(
        "AERO_UPLOAD_DIR", str(base_dir / "uploads")
    )
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    CORS(app, origins=os.environ.get("AERO_ALLOWED_ORIGINS", "*").split(","))

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
        VideoLike
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

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({"success": False, "message": "Uploaded file exceeds the 500MB limit"}), 413

    from backend.notification import notification_bp
    from backend.notification import routes as notification_routes

    app.register_blueprint(notification_bp)

    with app.app_context():
        db.create_all()
        if db.engine.dialect.name == "sqlite":
            post_columns = {
                column[1]
                for column in db.session.execute(text("PRAGMA table_info(posts)"))
            }
            if "parent_id" not in post_columns:
                db.session.execute(text("ALTER TABLE posts ADD COLUMN parent_id INTEGER"))
            if "type" not in post_columns:
                db.session.execute(text("ALTER TABLE posts ADD COLUMN type VARCHAR(12) NOT NULL DEFAULT 'original'"))
            columns = {
                column[1]
                for column in db.session.execute(text("PRAGMA table_info(users)"))
            }
            if "is_admin" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"
                ))
            if "is_banned" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT 0"
                ))
            if "bio" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN bio VARCHAR(150) NOT NULL DEFAULT ''"
                ))
            if "avatar_url" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NOT NULL DEFAULT ''"
                ))
            if "is_private" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0"
                ))
            if "show_online_status" not in columns:
                db.session.execute(text(
                    "ALTER TABLE users ADD COLUMN show_online_status BOOLEAN NOT NULL DEFAULT 1"
                ))
            for column_name in ("push_notifications", "notify_likes", "notify_comments"):
                if column_name not in columns:
                    db.session.execute(text(
                        f"ALTER TABLE users ADD COLUMN {column_name} BOOLEAN NOT NULL DEFAULT 1"
                    ))
            comment_columns = {
                column[1]
                for column in db.session.execute(text("PRAGMA table_info(comments)"))
            }
            if "image_url" not in comment_columns:
                db.session.execute(text(
                    "ALTER TABLE comments ADD COLUMN image_url VARCHAR(500) NOT NULL DEFAULT ''"
                ))
            message_columns = {column[1] for column in db.session.execute(text("PRAGMA table_info(messages)"))}
            if "media_url" not in message_columns:
                db.session.execute(text("ALTER TABLE messages ADD COLUMN media_url VARCHAR(500) NOT NULL DEFAULT ''"))
            if "type" not in message_columns:
                db.session.execute(text("ALTER TABLE messages ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text'"))
            video_comment_columns = {column[1] for column in db.session.execute(text("PRAGMA table_info(video_comments)"))}
            if "media_url" not in video_comment_columns:
                db.session.execute(text("ALTER TABLE video_comments ADD COLUMN media_url VARCHAR(500) NOT NULL DEFAULT ''"))
            if "type" not in video_comment_columns:
                db.session.execute(text("ALTER TABLE video_comments ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text'"))
            db.session.commit()

    from backend.admin import admin_bp
    from backend.admin import routes as admin_routes

    app.register_blueprint(admin_bp)

    return app
