from backend import db
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import validates
# introducing password hashing
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"
    VALID_ROLES = {"admin", "moderator", "user"}

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(50),
        unique=True,
        nullable=False,
        index=True
    )

    display_name = db.Column(db.String(80), default="", nullable=False)

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=False,
        index=True
    )

    bio = db.Column(db.String(150), default="", nullable=False)
    avatar_url = db.Column(db.String(500), default="", nullable=False)
    language_preference = db.Column(db.String(2), default=None, nullable=True)
    interest_embedding = db.Column(Vector(384), nullable=True)

    is_private = db.Column(db.Boolean, default=False, nullable=False)
    show_online_status = db.Column(db.Boolean, default=True, nullable=False)
    last_seen_at = db.Column(db.DateTime, nullable=True, index=True)
    push_notifications = db.Column(db.Boolean, default=True, nullable=False)
    notify_likes = db.Column(db.Boolean, default=True, nullable=False)
    notify_comments = db.Column(db.Boolean, default=True, nullable=False)

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    active = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    is_admin = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    role = db.Column(db.String(20), default="user", nullable=False)

    @validates("role")
    def validate_role(self, key, value):
        normalized = str(value or "user").strip().lower()
        if normalized not in self.VALID_ROLES:
            raise ValueError("role must be admin, moderator, or user")
        return normalized

    is_banned = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    ban_count = db.Column(
        db.Integer,
        default=0,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(
            self.password_hash,
            password
        )

    @property
    def is_authenticated(self):
        return True
