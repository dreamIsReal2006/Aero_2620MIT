from datetime import datetime

from backend import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    video_url = db.Column(db.String(500), nullable=False)
    caption = db.Column(db.Text, default="", nullable=False)
    track_name = db.Column(db.String(160), default="Original audio", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    author = db.relationship("User", backref=db.backref("videos", lazy=True))
