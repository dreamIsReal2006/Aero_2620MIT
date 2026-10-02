# Poll vote persistence model
# From: feed routes -> To: post_votes table
from datetime import datetime

from backend import db


class PostVote(db.Model):
    __tablename__ = "post_votes"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    option_index = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("post_id", "user_id", name="unique_post_vote"),
        db.CheckConstraint("option_index >= 0 AND option_index < 4", name="valid_post_vote_option"),
    )
