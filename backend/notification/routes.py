from backend import db
from backend.auth.routes import token_required
from backend.models import Notification, Post, User
from backend.notification import notification_bp
from flask import jsonify, request


@notification_bp.get("/notifications")
@token_required
def get_notifications(current_user):
    notifications = Notification.query.filter_by(
        recipient_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(100).all()
    unread_count = Notification.query.filter_by(
        recipient_id=current_user.id, is_read=False
    ).count()
    return jsonify({
        "notifications": [_notification_payload(item) for item in notifications],
        "unread_count": unread_count,
    })


@notification_bp.post("/notifications/read-all")
@token_required
def mark_notifications_read(current_user):
    Notification.query.filter_by(
        recipient_id=current_user.id, is_read=False
    ).update({"is_read": True}, synchronize_session=False)
    db.session.commit()
    return jsonify({"unread_count": 0})


@notification_bp.put("/settings/notifications")
@token_required
def update_notification_settings(current_user):
    data = request.get_json(silent=True) or {}
    allowed = {
        "push_notifications": "push_notifications",
        "likes": "notify_likes",
        "comments": "notify_comments",
        "notify_likes": "notify_likes",
        "notify_comments": "notify_comments",
    }
    for request_key, field_name in allowed.items():
        if request_key in data:
            setattr(current_user, field_name, bool(data[request_key]))
    db.session.commit()
    return jsonify({"settings": _settings_payload(current_user)})


@notification_bp.get("/settings/notifications")
@token_required
def get_notification_settings(current_user):
    return jsonify({"settings": _settings_payload(current_user)})


def _settings_payload(user):
    return {
        "push_notifications": user.push_notifications,
        "likes": user.notify_likes,
        "comments": user.notify_comments,
    }


def _notification_payload(notification):
    actor = db.session.get(User, notification.actor_id)
    post = db.session.get(Post, notification.post_id) if notification.post_id else None
    return {
        "id": notification.id,
        "type": notification.type,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": f"{notification.created_at.isoformat()}Z",
        "actor": {
            "id": actor.id if actor else None,
            "username": actor.username if actor else "Someone",
            "avatar_url": actor.avatar_url if actor else "",
        },
        "post_id": notification.post_id,
        "post_content": post.content if post else "",
    }
