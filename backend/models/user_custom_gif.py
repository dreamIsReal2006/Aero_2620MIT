# User-saved GIF model
# From: feed and chat clients -> To: user_custom_gifs table
from datetime import datetime

from backend import db


class UserCustomGif(db.Model):
    __tablename__ = "user_custom_gifs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    gif_url = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)