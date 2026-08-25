import os
from pathlib import Path

from flask import Flask
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
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
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
        Report
    )

    from backend.auth import auth_bp
    from backend.auth import routes

    app.register_blueprint(auth_bp)

    from backend.interact import interact_bp
    from backend.interact import routes as interact_routes

    app.register_blueprint(interact_bp)

    from backend.feed import feed_bp
    from backend.feed import routes as feed_routes

    app.register_blueprint(feed_bp)

    from backend.social import social_bp
    from backend.social import routes as social_routes

    app.register_blueprint(social_bp)

    with app.app_context():
        db.create_all()
        if db.engine.dialect.name == "sqlite":
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
            db.session.commit()

    from backend.admin import admin_bp
    from backend.admin import routes as admin_routes

    app.register_blueprint(admin_bp)

    return app
