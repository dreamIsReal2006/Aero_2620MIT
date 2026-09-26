import re

from backend import db
from backend.models import Notification, User

MENTION_PATTERN = re.compile(r"(?<![A-Za-z0-9_])@([A-Za-z0-9_]{1,50})")


def add_mention_notifications(content, actor, post_id, context):
    mentioned_names = {match.group(1).casefold() for match in MENTION_PATTERN.finditer(content or "")}
    if not mentioned_names:
        return []

    mentioned_users = User.query.filter(db.func.lower(User.username).in_(mentioned_names)).all()
    message = f"@{actor.username} mentioned you in a {context}"
    recipients = []
    for user in mentioned_users:
        if user.id == actor.id:
            continue
        recipients.append(user)
        db.session.add(Notification(
            recipient_id=user.id,
            actor_id=actor.id,
            post_id=post_id,
            type="mention",
            message=message,
        ))
    return recipients
