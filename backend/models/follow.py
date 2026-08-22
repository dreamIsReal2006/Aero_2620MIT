from datetime import datetime
from backend import db


class Follow(db.Model):
    __tablename__ = "follows"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    follower_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    following_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "follower_id",
            "following_id",
            name="unique_follow"
        ),

        db.Index(  # creates an index for follow relationships
            "idx_follow_graph",
            "follower_id",
            "following_id"
        ),
    )
