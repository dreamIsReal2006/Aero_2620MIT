# Video bookmark relationship model
# From: video routes -> video_bookmarks table
from datetime import datetime

from backend import db


class VideoBookmark(db.Model):
    __tablename__ = "video_bookmarks"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("user_id", "video_id", name="unique_video_bookmark"),)
