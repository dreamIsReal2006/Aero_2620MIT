import re

from backend import db
from backend.models import Notification, User

def add_mention_notifications(content, actor, post_id, context):
    users = User.query.filter(
        User.active.is_(True),
        User.is_banned.is_(False),
    ).all()
    username_by_key = {user.username.casefold(): user for user in users}
    usernames = sorted(username_by_key, key=len, reverse=True)
    if not usernames:
        return []

    pattern = re.compile(
        r"(?<![A-Za-z0-9_])@(" + "|".join(re.escape(name) for name in usernames) + r")(?![A-Za-z0-9_])",
        re.IGNORECASE,
    )
    mentioned_names = {match.group(1).casefold() for match in pattern.finditer(content or "")}
    if not mentioned_names:
        return []

    mentioned_users = [username_by_key[name] for name in mentioned_names]
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
