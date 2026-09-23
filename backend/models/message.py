from datetime import datetime

from backend import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("chat_groups.id"), nullable=True, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=True, index=True)
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(500), default="", nullable=False)
    type = db.Column(db.String(20), default="text", nullable=False)
    file_name = db.Column(db.String(255), default="", nullable=False)
    file_size = db.Column(db.Integer, default=0, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    sender = db.relationship("User", foreign_keys=[sender_id])

    __table_args__ = (
        db.Index(
            "idx_messages_conversation",
            "sender_id",
            "recipient_id",
            created_at.desc(),
        ),
        db.Index(
            "idx_messages_reverse_conversation",
            "recipient_id",
            "sender_id",
            created_at.desc(),
        ),
    )
