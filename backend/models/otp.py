from datetime import datetime

from backend import db


class OTPCode(db.Model):
    __tablename__ = "otp_codes"

    email = db.Column(db.String(120), primary_key=True)
    code_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)