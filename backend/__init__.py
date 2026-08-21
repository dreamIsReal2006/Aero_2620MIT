from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()  # creates database object


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = "change-this-secret-key"
    # Use SQLite and call the database aero.db.
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///aero.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)  # connects SQLAlchemy to Flask

    from backend.models import (
        User,
        Post,
        Comment,
        Follow,
        Like
    )

    from backend.auth import auth_bp
    app.register_blueprint(auth_bp)

    with app.app_context():
        db.create_all()

    return app
