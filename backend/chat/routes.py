import json
from pathlib import Path

from flask import jsonify, request
from sqlalchemy.orm import joinedload, load_only
from werkzeug.utils import secure_filename

from backend import db
from backend.auth.routes import token_required
from backend.chat import chat_bp
from backend.models import Block, ChatGroup, ChatGroupMember, Follow, Message, Mute, Note, Post, User
from backend.presence import is_user_online
from backend.storage import upload_file_to_supabase

CHAT_UPLOAD_TYPES = {
    "image/": "image", "video/": "video",
    "audio/": "audio",
    "application/pdf": "document", "text/plain": "document",
    "application/msword": "document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}
CHAT_MESSAGE_LIMIT = 30


def _user_payload(user, viewer_id=None):
    is_muted = viewer_id is not None and Mute.query.filter_by(
        muter_id=viewer_id, muted_id=user.id
    ).first() is not None
    return {"id": user.id, "username": user.username, "display_name": user.display_name or user.username, "avatar_url": user.avatar_url or "", "role": user.role if user.role in {"admin", "moderator", "user"} else "user", "is_online": is_user_online(user, viewer_id), "is_muted": is_muted}


def _group_payload(group, current_user_id):
    latest = Message.query.filter_by(group_id=group.id).order_by(Message.created_at.desc()).first()
    unread_count = Message.query.filter(
        Message.group_id == group.id,
        Message.recipient_id == current_user_id,
        Message.sender_id != current_user_id,
        Message.is_read.is_(False),
    ).count()
    return {
        "id": group.id,
        "group_id": group.id,
        "kind": "group",
        "is_group": True,
        "name": group.name,
        "username": group.name,
        "owner_id": group.owner_id,
        "member_count": ChatGroupMember.query.filter_by(group_id=group.id).count(),
        "latest_message": latest.content if latest else "",
        "latest_message_at": f"{latest.created_at.isoformat()}Z" if latest else "",
        "unread_count": unread_count,
        "is_owner": group.owner_id == current_user_id,
    }


def _group_member(group_id, user_id):
    return ChatGroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()


@chat_bp.get("/chat/groups")
@token_required
def get_groups(current_user):
    memberships = ChatGroupMember.query.filter_by(user_id=current_user.id).all()
    groups = [db.session.get(ChatGroup, membership.group_id) for membership in memberships]
    return jsonify([_group_payload(group, current_user.id) for group in groups if group])


@chat_bp.post("/chat/groups")
@token_required
def create_group(current_user):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    raw_member_ids = data.get("member_ids", data.get("memberIds", []))
    if not name or len(name) > 80 or not isinstance(raw_member_ids, list):
        return jsonify({"message": "A group name and member list are required"}), 400
    try:
        member_ids = {int(user_id) for user_id in raw_member_ids}
    except (TypeError, ValueError):
        return jsonify({"message": "Member IDs must be valid"}), 400
    member_ids.discard(current_user.id)
    if not member_ids:
        return jsonify({"message": "Choose at least one other member"}), 400
    members = User.query.filter(User.id.in_(member_ids), User.active.is_(True), User.is_banned.is_(False)).all()
    if len(members) != len(member_ids):
        return jsonify({"message": "One or more selected members are unavailable"}), 400
    group = ChatGroup(name=name, owner_id=current_user.id)
    db.session.add(group)
    db.session.flush()
    db.session.add(ChatGroupMember(group_id=group.id, user_id=current_user.id, is_admin=True))
    db.session.add_all(ChatGroupMember(group_id=group.id, user_id=user.id) for user in members)
    db.session.commit()
    return jsonify(_group_payload(group, current_user.id)), 201


@chat_bp.get("/chat/groups/<int:group_id>/members")
@token_required
def get_group_members(current_user, group_id):
    group = db.session.get(ChatGroup, group_id)
    if not group or not _group_member(group_id, current_user.id):
        return jsonify({"message": "Group not found"}), 404
    members = ChatGroupMember.query.filter_by(group_id=group_id).all()
    return jsonify({
        "group": _group_payload(group, current_user.id),
        "members": [{**_user_payload(member.user, current_user.id), "is_admin": member.is_admin} for member in members],
    })


@chat_bp.delete("/chat/groups/<int:group_id>")
@token_required
def delete_group(current_user, group_id):
    group = db.session.get(ChatGroup, group_id)
    if not group or group.owner_id != current_user.id:
        return jsonify({"message": "Only the group owner can delete this group"}), 403
    Message.query.filter_by(group_id=group_id).delete(synchronize_session=False)
    ChatGroupMember.query.filter_by(group_id=group_id).delete(synchronize_session=False)
    db.session.delete(group)
    db.session.commit()
    return jsonify({"deleted": True, "group_id": group_id})


@chat_bp.post("/chat/groups/<int:group_id>/leave")
@token_required
def leave_group(current_user, group_id):
    group = db.session.get(ChatGroup, group_id)
    membership = _group_member(group_id, current_user.id)
    if not group or not membership:
        return jsonify({"message": "Group not found"}), 404
    if group.owner_id == current_user.id:
        return jsonify({"message": "The group owner must delete the group instead"}), 400
    db.session.delete(membership)
    db.session.commit()
    return jsonify({"left": True, "group_id": group_id})


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
        item["latest_message_at"] = f"{latest.created_at.isoformat()}Z" if latest else ""
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


@chat_bp.post("/chat/messages/mark-read")
@token_required
def mark_messages_read(current_user):
    data = request.get_json(silent=True) or {}
    try:
        group_id = int(data.get("group_id", 0) or 0)
    except (TypeError, ValueError):
        group_id = 0
    try:
        sender_id = int(data.get("sender_id", 0) or 0)
    except (TypeError, ValueError):
        sender_id = 0

    if group_id:
        if not _group_member(group_id, current_user.id):
            return jsonify({"message": "Group not found"}), 404
        query = Message.query.filter(
            Message.group_id == group_id,
            Message.recipient_id == current_user.id,
            Message.sender_id != current_user.id,
            Message.is_read.is_(False),
        )
    elif sender_id and db.session.get(User, sender_id):
        query = Message.query.filter(
            Message.sender_id == sender_id,
            Message.recipient_id == current_user.id,
            Message.group_id.is_(None),
            Message.is_read.is_(False),
        )
    else:
        return jsonify({"message": "A valid conversation is required"}), 400

    updated_count = query.update({Message.is_read: True}, synchronize_session=False)
    db.session.commit()
    unread_count = Message.query.filter_by(
        recipient_id=current_user.id,
        is_read=False,
    ).count()
    return jsonify({"marked_read": updated_count, "unread_count": unread_count}), 200


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
        group_id = int(request.args.get("group_id", "0"))
    except ValueError:
        group_id = 0
    if group_id:
        group = db.session.get(ChatGroup, group_id)
        if not group or not _group_member(group_id, current_user.id):
            return jsonify({"message": "Group not found"}), 404
        messages = Message.query.filter_by(group_id=group_id).options(
            joinedload(Message.sender).load_only(User.id, User.username),
            joinedload(Message.post).load_only(
                Post.id, Post.content, Post.images_json
            ).joinedload(Post.author).load_only(
                User.id, User.username, User.avatar_url
            ),
        ).order_by(Message.created_at.desc()).limit(CHAT_MESSAGE_LIMIT).all()
        recipient_id = None
    else:
        recipient_id = None
        messages = []
    try:
        user_id = int(request.args.get("contact_id", request.args.get("user_id", "0")))
    except ValueError:
        user_id = 0
    if group_id:
        user_id = 0
    elif not db.session.get(User, user_id):
        return jsonify({"message": "Contact not found"}), 404
    else:
        messages = Message.query.filter(
            (
                ((Message.sender_id == current_user.id) & (Message.recipient_id == user_id)) |
                ((Message.sender_id == user_id) & (Message.recipient_id == current_user.id))
            ),
            Message.group_id.is_(None),
        ).options(
            joinedload(Message.sender).load_only(User.id, User.username),
            joinedload(Message.post).load_only(
                Post.id, Post.content, Post.images_json
            ).joinedload(Post.author).load_only(
                User.id, User.username, User.avatar_url
            ),
        ).order_by(Message.created_at.desc()).limit(CHAT_MESSAGE_LIMIT).all()
        Message.query.filter_by(sender_id=user_id, recipient_id=current_user.id, is_read=False).update(
            {Message.is_read: True}, synchronize_session=False
        )
    db.session.commit()
    payload = []
    for message in reversed(messages):
        shared_post = None
        if message.type in {"post_share", "shared_post"} and message.post_id:
            post = message.post
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
        "group_id": message.group_id,
        "content": message.content,
        "media_url": message.media_url or "",
        "type": message.type or "text",
        "sender_id": message.sender_id,
        "sender_username": message.sender.username if message.sender else "User",
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
    try:
        public_url = upload_file_to_supabase(file, "chat")
    except (RuntimeError, ValueError) as error:
        return jsonify({"message": str(error)}), 500
    return jsonify({"url": public_url, "type": attachment_type, "file_name": file.filename, "file_size": request.content_length or 0}), 201


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
        group_id = int(data.get("group_id", 0) or 0)
    except (TypeError, ValueError):
        group_id = 0
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
    group = db.session.get(ChatGroup, group_id) if group_id else None
    if group_id and (not group or not _group_member(group_id, current_user.id)):
        return jsonify({"message": "Group not found"}), 404
    if not group_id and (not db.session.get(User, recipient_id)):
        return jsonify({"message": "A valid recipient and message are required"}), 400
    if (not content and not media_url) or len(content) > 2000 or len(media_url) > 500:
        return jsonify({"message": "A valid recipient and message are required"}), 400
    if not group_id and (Block.query.filter_by(blocker_id=recipient_id, blocked_id=current_user.id).first() or Block.query.filter_by(blocker_id=current_user.id, blocked_id=recipient_id).first()):
        return jsonify({"message": "Messaging is unavailable for this contact"}), 403
    message = Message(sender_id=current_user.id, recipient_id=current_user.id if group_id else recipient_id, group_id=group_id or None, content=content, media_url=media_url, type=message_type, file_name=file_name, file_size=file_size)
    db.session.add(message)
    db.session.commit()
    return jsonify({"id": message.id, "group_id": message.group_id, "content": message.content, "media_url": message.media_url, "type": message.type, "file_name": message.file_name, "file_size": message.file_size, "sender_id": message.sender_id, "created_at": f"{message.created_at.isoformat()}Z"}), 201
