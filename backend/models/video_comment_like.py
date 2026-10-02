# Video comment like model
# From: video routes -> To: video_comment_likes table
from datetime import datetime

from backend import db


class VideoCommentLike(db.Model):
    __tablename__ = "video_comment_likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    video_comment_id = db.Column(db.Integer, db.ForeignKey("video_comments.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "video_comment_id", name="unique_video_comment_like"),
    )