from flask import jsonify, request

from backend import db
from backend.auth.routes import token_required
from backend.chat import chat_bp
from backend.models import Follow, Message, Note, User


def _user_payload(user):
    return {"id": user.id, "username": user.username, "avatar_url": user.avatar_url or ""}


@chat_bp.get("/friends")
@chat_bp.get("/followers")
@chat_bp.get("/chat/contacts")
@token_required
def get_contacts(current_user):
    followed_ids = [row.following_id for row in Follow.query.filter_by(follower_id=current_user.id).all()]
    follower_ids = [row.follower_id for row in Follow.query.filter_by(following_id=current_user.id).all()]
    ids = set(followed_ids + follower_ids)
    contacts = User.query.filter(User.id.in_(ids)).order_by(User.username.asc()).all() if ids else []
    payload = []
    for user in contacts:
        latest = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.recipient_id == user.id)) |
            ((Message.sender_id == user.id) & (Message.recipient_id == current_user.id))
        ).order_by(Message.created_at.desc()).first()
        item = _user_payload(user)
        item["latest_message"] = latest.content if latest else ""
        item["unread_count"] = 0
        payload.append(item)
    return jsonify(payload)


@chat_bp.get("/notes")
@token_required
def get_notes(current_user):
    followed_ids = [row.following_id for row in Follow.query.filter_by(follower_id=current_user.id).all()]
    notes = Note.query.filter(Note.user_id.in_(followed_ids)).order_by(Note.created_at.desc()).limit(30).all() if followed_ids else []
    return jsonify([{"id": note.id, "content": note.content, "created_at": f"{note.created_at.isoformat()}Z", "author": _user_payload(note.author)} for note in notes])


@chat_bp.get("/chat/messages")
@token_required
def get_messages(current_user):
    try:
        user_id = int(request.args.get("contact_id", request.args.get("user_id", "0")))
    except ValueError:
        user_id = 0
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.asc()).limit(200).all()
    return jsonify([{
        "id": message.id,
        "content": message.content,
        "media_url": message.media_url or "",
        "type": message.type or "text",
        "sender_id": message.sender_id,
        "created_at": f"{message.created_at.isoformat()}Z",
    } for message in messages])


@chat_bp.post("/messages")
@chat_bp.post("/chat/messages")
@token_required
def send_message(current_user):
    data = request.get_json(silent=True) or {}
    try:
        recipient_id = int(data.get("recipient_id", data.get("user_id")))
    except (TypeError, ValueError):
        recipient_id = 0
    content = str(data.get("content") or "").strip()
    media_url = str(data.get("media_url") or "").strip()
    message_type = "gif" if str(data.get("type") or "").lower() == "gif" and media_url else "text"
    if not db.session.get(User, recipient_id) or (not content and not media_url) or len(content) > 2000 or len(media_url) > 500:
        return jsonify({"message": "A valid recipient and message are required"}), 400
    message = Message(sender_id=current_user.id, recipient_id=recipient_id, content=content, media_url=media_url, type=message_type)
    db.session.add(message)
    db.session.commit()
    return jsonify({"id": message.id, "content": message.content, "media_url": message.media_url, "type": message.type, "sender_id": message.sender_id, "created_at": f"{message.created_at.isoformat()}Z"}), 201
