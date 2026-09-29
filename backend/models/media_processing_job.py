from datetime import datetime

from backend import db


class MediaProcessingJob(db.Model):
    __tablename__ = "media_processing_jobs"

    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(db.String(20), default="queued", nullable=False, index=True)
    progress = db.Column(db.Integer, default=0, nullable=False)
    media_url = db.Column(db.String(500), default="", nullable=False)
    error_message = db.Column(db.String(500), default="", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)