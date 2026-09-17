from datetime import datetime

from backend import db


class Mute(db.Model):
    __tablename__ = "mutes"

    id = db.Column(db.Integer, primary_key=True)
    muter_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    muted_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    __table_args__ = (
        db.UniqueConstraint("muter_id", "muted_id", name="unique_mute"),
    )
