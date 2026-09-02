from datetime import datetime
from backend import db


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    content = db.Column(
        db.Text,
        nullable=False
    )

    image_url = db.Column(db.String(500), default="", nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    post_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id"),
        nullable=False
    )

    parent_id = db.Column(  # points back to another comment
        db.Integer,
        db.ForeignKey("comments.id"),
        nullable=True
    )

    author = db.relationship(
        "User",
        backref="comments"
    )

    replies = db.relationship(
        "Comment",
        backref=db.backref(
            "parent",
            remote_side=[id]
        ),
        lazy=True
    )
