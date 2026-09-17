import json
import uuid
from pathlib import Path

from flask import current_app, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from backend import db
from backend.auth.routes import token_required
from backend.chat import chat_bp
from backend.models import Block, Follow, Message, Mute, Note, Post, User
from backend.presence import is_user_online

CHAT_UPLOAD_TYPES = {
    "image/": "image", "video/": "video",
    "audio/": "audio",
    "application/pdf": "document", "text/plain": "document",
    "application/msword": "document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}


def _user_payload(user, viewer_id=None):
    is_muted = viewer_id is not None and Mute.query.filter_by(
        muter_id=viewer_id, muted_id=user.id
    ).first() is not None
    return {"id": user.id, "username": user.username, "display_name": user.display_name or user.username, "avatar_url": user.avatar_url or "", "role": user.role if user.role in {"admin", "moderator", "user"} else "user", "is_online": is_user_online(user, viewer_id), "is_muted": is_muted}


@chat_bp.get("/friends")
@chat_bp.get("/followers")
@chat_bp.get("/chat/contacts")
@token_required
def get_contacts(current_user):
    followed_ids = [row.following_id for row in Follow.query.filter_by(follower_id=current_user.id, status="approved").all()]
    follower_ids = [row.follower_id for row in Follow.query.filter_by(following_id=current_user.id, status="approved").all()]
    ids = set(followed_ids + follower_ids)
    contacts = User.query.filter(User.id.in_(ids)).order_by(User.username.asc()).all() if ids else []
    payload = []
    for user in contacts:
        latest = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.recipient_id == user.id)) |
            ((Message.sender_id == user.id) & (Message.recipient_id == current_user.id))
        ).order_by(Message.created_at.desc()).first()
        item = _user_payload(user, current_user.id)
        item["latest_message"] = latest.content if latest else ""
        item["unread_count"] = Message.query.filter_by(
            sender_id=user.id, recipient_id=current_user.id, is_read=False
        ).count()
        payload.append(item)
    return jsonify(payload)


@chat_bp.get("/chat/unread-count")
@token_required
def get_unread_count(current_user):
    unread_count = Message.query.filter_by(
        recipient_id=current_user.id, is_read=False
    ).count()
    return jsonify({"unread_count": unread_count})


@chat_bp.get("/notes")
@token_required
def get_notes(current_user):
    followed_ids = [row.following_id for row in Follow.query.filter_by(follower_id=current_user.id, status="approved").all()]
    notes = Note.query.filter(Note.user_id.in_(followed_ids)).order_by(Note.created_at.desc()).limit(30).all() if followed_ids else []
    return jsonify([{"id": note.id, "content": note.content, "created_at": f"{note.created_at.isoformat()}Z", "author": _user_payload(note.author, current_user.id)} for note in notes])


@chat_bp.get("/chat/messages")
@token_required
def get_messages(current_user):
    try:
        user_id = int(request.args.get("contact_id", request.args.get("user_id", "0")))
    except ValueError:
        user_id = 0
    if not db.session.get(User, user_id):
        return jsonify({"message": "Contact not found"}), 404
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.asc()).limit(200).all()
    Message.query.filter_by(sender_id=user_id, recipient_id=current_user.id, is_read=False).update(
        {Message.is_read: True}, synchronize_session=False
    )
    db.session.commit()
    payload = []
    for message in messages:
        shared_post = None
        if message.type in {"post_share", "shared_post"} and message.post_id:
            post = db.session.get(Post, message.post_id)
            if post:
                try:
                    images = json.loads(post.images_json or "[]")
                except (TypeError, ValueError):
                    images = []
                shared_post = {
                    "id": post.id,
                    "content": post.content or "",
                    "images": images,
                    "username": post.author.username if post.author else "User",
                    "avatar_url": post.author.avatar_url if post.author else "",
                }
        payload.append({
        "id": message.id,
        "post_id": message.post_id,
        "content": message.content,
        "media_url": message.media_url or "",
        "type": message.type or "text",
        "sender_id": message.sender_id,
        "created_at": f"{message.created_at.isoformat()}Z",
        "can_delete": message.sender_id == current_user.id,
        "file_name": message.file_name or "",
        "file_size": message.file_size or 0,
        "shared_post": shared_post,
    })
    return jsonify(payload)


@chat_bp.post("/chat/uploads")
@token_required
def upload_chat_attachment(current_user):
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"message": "A file is required"}), 400
    mime = file.mimetype or "application/octet-stream"
    attachment_type = next((kind for prefix, kind in CHAT_UPLOAD_TYPES.items() if mime == prefix or mime.startswith(prefix)), None)
    if not attachment_type:
        return jsonify({"message": "This file type is not supported"}), 400
    if request.content_length and request.content_length > 50 * 1024 * 1024:
        return jsonify({"message": "Attachments must be 50 MB or smaller"}), 413
    extension = Path(secure_filename(file.filename)).suffix.lower()[:10]
    filename = f"chat-{uuid.uuid4().hex}{extension}"
    file.save(Path(current_app.config["UPLOAD_FOLDER"]) / filename)
    return jsonify({"url": f"/uploads/{filename}", "type": attachment_type, "file_name": file.filename, "file_size": request.content_length or 0}), 201


@chat_bp.post("/chat/contacts/<int:user_id>/block")
@token_required
def block_contact(current_user, user_id):
    if user_id == current_user.id or not db.session.get(User, user_id):
        return jsonify({"message": "Invalid contact"}), 400
    if not Block.query.filter_by(blocker_id=current_user.id, blocked_id=user_id).first():
        db.session.add(Block(blocker_id=current_user.id, blocked_id=user_id))
        db.session.commit()
    return jsonify({"blocked": True})


@chat_bp.get("/chat/contacts/<int:user_id>/block")
@token_required
def get_block_status(current_user, user_id):
    blocked = Block.query.filter_by(blocker_id=current_user.id, blocked_id=user_id).first() is not None
    return jsonify({"blocked": blocked})


@chat_bp.delete("/chat/contacts/<int:user_id>/block")
@token_required
def unblock_contact(current_user, user_id):
    block = Block.query.filter_by(blocker_id=current_user.id, blocked_id=user_id).first()
    if block:
        db.session.delete(block)
        db.session.commit()
    return jsonify({"blocked": False})


@chat_bp.post("/chat/contacts/<int:user_id>/mute")
@token_required
def mute_contact(current_user, user_id):
    if user_id == current_user.id or not db.session.get(User, user_id):
        return jsonify({"message": "Invalid contact"}), 400
    if not Mute.query.filter_by(
        muter_id=current_user.id, muted_id=user_id
    ).first():
        db.session.add(Mute(muter_id=current_user.id, muted_id=user_id))
        db.session.commit()
    return jsonify({"muted": True})


@chat_bp.get("/chat/contacts/<int:user_id>/mute")
@token_required
def get_mute_status(current_user, user_id):
    muted = Mute.query.filter_by(
        muter_id=current_user.id, muted_id=user_id
    ).first() is not None
    return jsonify({"muted": muted})


@chat_bp.delete("/chat/contacts/<int:user_id>/mute")
@token_required
def unmute_contact(current_user, user_id):
    mute = Mute.query.filter_by(
        muter_id=current_user.id, muted_id=user_id
    ).first()
    if mute:
        db.session.delete(mute)
        db.session.commit()
    return jsonify({"muted": False})


@chat_bp.delete("/chat/messages/<int:message_id>")
@token_required
def delete_message(current_user, message_id):
    message = db.session.get(Message, message_id)
    if not message or message.sender_id != current_user.id:
        return jsonify({"message": "Message not found"}), 404
    db.session.delete(message)
    db.session.commit()
    return jsonify({"deleted": True, "id": message_id})


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
    if str(data.get("type") or "").lower() in {"image", "video", "document"}:
        message_type = str(data.get("type")).lower()
    file_name = str(data.get("file_name") or "").strip()[:255]
    try:
        file_size = max(0, int(data.get("file_size") or 0))
    except (TypeError, ValueError):
        file_size = 0
    if not db.session.get(User, recipient_id) or (not content and not media_url) or len(content) > 2000 or len(media_url) > 500:
        return jsonify({"message": "A valid recipient and message are required"}), 400
    if Block.query.filter_by(blocker_id=recipient_id, blocked_id=current_user.id).first() or Block.query.filter_by(blocker_id=current_user.id, blocked_id=recipient_id).first():
        return jsonify({"message": "Messaging is unavailable for this contact"}), 403
    message = Message(sender_id=current_user.id, recipient_id=recipient_id, content=content, media_url=media_url, type=message_type, file_name=file_name, file_size=file_size)
    db.session.add(message)
    db.session.commit()
    return jsonify({"id": message.id, "content": message.content, "media_url": message.media_url, "type": message.type, "file_name": message.file_name, "file_size": message.file_size, "sender_id": message.sender_id, "created_at": f"{message.created_at.isoformat()}Z"}), 201
