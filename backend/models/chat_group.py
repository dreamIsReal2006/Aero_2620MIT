from datetime import datetime

from backend import db


class ChatGroup(db.Model):
    __tablename__ = "chat_groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    owner = db.relationship("User", foreign_keys=[owner_id])


class ChatGroupMember(db.Model):
    __tablename__ = "chat_group_members"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("chat_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    group = db.relationship("ChatGroup", backref=db.backref("members", lazy=True, cascade="all, delete-orphan"))
    user = db.relationship("User", foreign_keys=[user_id])
    __table_args__ = (db.UniqueConstraint("group_id", "user_id", name="uq_chat_group_member"),)
