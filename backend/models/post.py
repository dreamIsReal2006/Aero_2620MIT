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

    parent_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id"),
        nullable=True,
        index=True
    )

    type = db.Column(
        db.String(12),
        nullable=False,
        default="original",
        index=True
    )

    parent = db.relationship(
        "Post",
        remote_side=[id],
        backref=db.backref("reposts", lazy=True)
    )

    author = db.relationship(
        "User",
        backref=db.backref(
            "posts",
            lazy=True
        )
    )
