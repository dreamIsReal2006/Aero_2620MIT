from datetime import datetime

from backend import db


class Hashtag(db.Model):
    __tablename__ = "hashtags"

    id = db.Column(db.Integer, primary_key=True)
    tag = db.Column(db.String(100), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class PostHashtag(db.Model):
    __tablename__ = "post_hashtags"

    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    hashtag_id = db.Column(db.Integer, db.ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True)


class UserHashtagInterest(db.Model):
    __tablename__ = "user_hashtag_interests"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    hashtag_id = db.Column(db.Integer, db.ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True)
    weight = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)