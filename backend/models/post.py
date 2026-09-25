import json
from datetime import datetime
from backend import db


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    content = db.Column(
        db.Text,
        nullable=False
    )

    images_json = db.Column(
        db.Text,
        default="[]",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    parent_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=True, index=True)
    type = db.Column(db.String(12), nullable=False, default="original", index=True)
    embedding = db.Column(db.Text, nullable=True)

    parent = db.relationship(
        "Post",
        remote_side=[id],
        backref=db.backref(
            "reposts",
            lazy=True,
            cascade="all, delete-orphan",
        ),
    )

    comments = db.relationship(
        "Comment",
        backref="post",
        cascade="all, delete-orphan",
        lazy=True,
    )
    likes = db.relationship(
        "Like",
        backref="post",
        cascade="all, delete-orphan",
        lazy=True,
    )
    interactions = db.relationship(
        "UserInteraction",
        backref="post",
        cascade="all, delete-orphan",
        lazy=True,
    )
    notifications = db.relationship(
        "Notification",
        backref="post",
        cascade="all, delete-orphan",
        lazy=True,
    )
    messages = db.relationship(
        "Message",
        backref="post",
        cascade="all, delete-orphan",
        lazy=True,
    )

    author = db.relationship(
        "User",
        backref=db.backref(
            "posts",
            lazy=True
        )
    )
