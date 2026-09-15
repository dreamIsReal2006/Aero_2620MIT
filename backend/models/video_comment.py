from datetime import datetime

from backend import db


class VideoComment(db.Model):
    __tablename__ = "video_comments"

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(500), default="", nullable=False)
    type = db.Column(db.String(20), default="text", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    author = db.relationship("User")