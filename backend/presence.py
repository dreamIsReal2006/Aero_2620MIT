# User presence and last-seen service
# From: chat/activity requests -> To: user presence fields and response payloads
from datetime import datetime, timedelta


ONLINE_WINDOW = timedelta(minutes=2)


def has_recent_presence(user):
    return bool(user and user.last_seen_at and datetime.utcnow() - user.last_seen_at <= ONLINE_WINDOW)


def is_user_online(user, viewer_id=None):
    if not user or not user.show_online_status:
        return False
    if viewer_id is not None and user.id == viewer_id:
        return True
    return has_recent_presence(user)
