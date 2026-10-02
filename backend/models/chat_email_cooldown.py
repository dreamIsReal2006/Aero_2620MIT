# Chat email notification cooldown model
# From: chat service -> To: chat_email_cooldowns table
from datetime import datetime

from backend import db


class ChatEmailCooldown(db.Model):
    __tablename__ = "chat_email_cooldowns"

    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    last_sent_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)