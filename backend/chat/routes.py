# Chat, group, presence, and unread-count routes
# From: static/js/chat.js -> To: messages tables and JSON chat payloads
import json
import logging
import os
import re
import subprocess
import tempfile
import threading
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from flask import current_app, jsonify, request
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import joinedload, load_only
from werkzeug.utils import secure_filename

from backend import db
from backend.auth.routes import token_required
from backend.chat import chat_bp
from backend.email_service import send_chat_message_email
from backend.models import Block, ChatEmailCooldown, ChatGroup, ChatGroupMember, Follow, Message, Mute, Note, Post, User, UserCustomGif
from backend.presence import has_recent_presence, is_user_online
from backend.storage import upload_file_to_supabase

CHAT_UPLOAD_TYPES = {
    "image/": "image", "video/": "video",
    "audio/": "audio",
    "application/pdf": "document", "text/plain": "document",
    "application/msword": "document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}
CHAT_MESSAGE_LIMIT = 30
CHAT_EMAIL_COOLDOWN = timedelta(minutes=15)
MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_CUSTOM_GIF_BYTES = 1_000_000
CUSTOM_GIF_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
logger = logging.getLogger(__name__)


def _send_offline_chat_email(app, recipient_id, sender_id, recipient_email, sender_name):
    with app.app_context():
        now = datetime.utcnow()
        cutoff = now - CHAT_EMAIL_COOLDOWN
        statement = pg_insert(ChatEmailCooldown).values(
            recipient_id=recipient_id,
            sender_id=sender_id,
            last_sent_at=now,
        ).on_conflict_do_update(
            index_elements=[ChatEmailCooldown.recipient_id, ChatEmailCooldown.sender_id],
            set_={"last_sent_at": now},
            where=ChatEmailCooldown.last_sent_at <= cutoff,
        ).returning(ChatEmailCooldown.sender_id)
        try:
            should_send = db.session.execute(statement).scalar_one_or_none() is not None
            db.session.commit()
            if should_send:
                send_chat_message_email(recipient_email, sender_name, sender_id)
        except Exception:
            db.session.rollback()
            logger.exception("Unable to queue offline chat email for recipient %s", recipient_id)


def _user_payload(user, viewer_id=None):
    is_muted = viewer_id is not None and Mute.query.filter_by(
        muter_id=viewer_id, muted_id=user.id
    ).first() is not None
    return {"id": user.id, "username": user.username, "display_name": user.display_name or user.username, "avatar_url": user.avatar_url or "", "role": user.role if user.role in {"admin", "moderator", "user"} else "user", "is_online": is_user_online(user, viewer_id), "is_muted": is_muted}


def _group_payload(group, current_user_id):
    latest = Message.query.filter_by(group_id=group.id).order_by(Message.created_at.desc()).first()
    membership = ChatGroupMember.query.filter_by(group_id=group.id, user_id=current_user_id).first()
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
        "latest_message_type": latest.type if latest else "",
        "latest_message_at": f"{latest.created_at.isoformat()}Z" if latest else "",
        "unread_count": unread_count,
        "is_owner": group.owner_id == current_user_id,
        "is_admin": bool(membership and membership.is_admin),
    }


def _group_member(group_id, user_id):
    return ChatGroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()


def _add_group_system_message(group_id, actor, event, **details):
    content = json.dumps({
        "event": event,
        "actor_id": actor.id,
        "actor_username": actor.username,
        **details,
    }, ensure_ascii=False)
    db.session.add(Message(
        sender_id=actor.id,
        recipient_id=actor.id,
        group_id=group_id,
        content=content,
        type="system",
    ))


@chat_bp.get("/chat/my-gifs")
@token_required
def get_my_gifs(current_user):
    gifs = UserCustomGif.query.filter_by(user_id=current_user.id).order_by(
        UserCustomGif.created_at.desc()
    ).limit(100).all()
    return jsonify({"gifs": [
        {"id": gif.id, "gif_url": gif.gif_url, "created_at": f"{gif.created_at.isoformat()}Z"}
        for gif in gifs
    ]})


@chat_bp.get("/chat/gifs")
@token_required
def search_chat_gifs(current_user):
    api_key = os.getenv("GIPHY_API_KEY", "").strip()
    if not api_key:
        return jsonify({"gifs": [], "provider_configured": False})
    query = str(request.args.get("q", "")).strip()[:80]
    endpoint = "search" if query else "trending"
    params = urlencode({"api_key": api_key, "limit": 24, "rating": "pg", **({"q": query} if query else {})})
    try:
        with urlopen(f"https://api.giphy.com/v1/gifs/{endpoint}?{params}", timeout=8) as response:
            payload = json.load(response)
        gifs = []
        for item in payload.get("data", []):
            images = item.get("images", {})
            image = images.get("fixed_width_small") or images.get("fixed_width") or images.get("original") or {}
            original = images.get("original") or image
            if image.get("url") and original.get("url"):
                gifs.append({"preview_url": image["url"], "gif_url": original["url"]})
        return jsonify({"gifs": gifs, "provider_configured": True})
    except Exception:
        logger.exception("Unable to load GIF results from GIPHY")
        return jsonify({"message": "GIF search is temporarily unavailable"}), 502


@chat_bp.post("/chat/upload-video-to-gif")
@token_required
def upload_video_to_gif(current_user):
    video = request.files.get("file")
    if not video or not video.filename:
        return jsonify({"message": "A video file is required"}), 400
    extension = Path(secure_filename(video.filename)).suffix.lower()
    if extension not in CUSTOM_GIF_EXTENSIONS:
        return jsonify({"message": "Use an MP4, MOV, M4V, or WebM video"}), 400
    video_bytes = video.stream.read(MAX_VIDEO_UPLOAD_BYTES + 1)
    if not video_bytes:
        return jsonify({"message": "The video file is empty"}), 400
    if len(video_bytes) > MAX_VIDEO_UPLOAD_BYTES:
        return jsonify({"message": "Videos must be 25 MB or smaller"}), 413

    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        with tempfile.TemporaryDirectory(prefix="aero-chat-gif-") as temp_dir:
            input_path = Path(temp_dir) / f"input{extension}"
            input_path.write_bytes(video_bytes)
            probe = subprocess.run(
                [ffmpeg, "-hide_banner", "-i", str(input_path)],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            probe_output = probe.stderr or probe.stdout
            duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", probe_output)
            if not duration_match:
                return jsonify({"message": "The uploaded video could not be read"}), 400
            duration = int(duration_match.group(1)) * 3600 + int(duration_match.group(2)) * 60 + float(duration_match.group(3))
            if duration > 15:
                return jsonify({"message": "Videos must be 15 seconds or shorter"}), 400

            gif_path = Path(temp_dir) / "converted.gif"
            gif_bytes = None
            for width, fps, colors in ((320, 10, 96), (240, 8, 64), (180, 6, 48)):
                filter_graph = (
                    f"fps={fps},scale='min({width},iw)':-1:flags=lanczos,split[a][b];"
                    f"[a]palettegen=max_colors={colors}[p];"
                    "[b][p]paletteuse=dither=bayer:bayer_scale=4"
                )
                result = subprocess.run(
                    [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(input_path),
                     "-t", "15", "-vf", filter_graph, "-loop", "0", "-an", str(gif_path)],
                    capture_output=True,
                    text=True,
                    timeout=90,
                    check=False,
                )
                if result.returncode != 0:
                    logger.warning("FFmpeg could not convert uploaded video: %s", result.stderr[-1000:])
                    return jsonify({"message": "The uploaded video could not be converted"}), 400
                gif_bytes = gif_path.read_bytes()
                if len(gif_bytes) <= MAX_CUSTOM_GIF_BYTES:
                    break
            if not gif_bytes or len(gif_bytes) > MAX_CUSTOM_GIF_BYTES:
                return jsonify({"message": "This video is too complex to compress below 1 MB"}), 413

        upload = BytesIO(gif_bytes)
        upload.filename = "custom.gif"
        upload.mimetype = "image/gif"
        gif_url = upload_file_to_supabase(upload, "chat-gifs")
        gif = UserCustomGif(user_id=current_user.id, gif_url=gif_url)
        db.session.add(gif)
        db.session.commit()
    except (RuntimeError, ValueError) as error:
        db.session.rollback()
        return jsonify({"message": str(error)}), 503
    except subprocess.TimeoutExpired:
        return jsonify({"message": "Video conversion timed out; try a shorter clip"}), 400
    except Exception:
        db.session.rollback()
        logger.exception("Unable to convert custom chat GIF for user %s", current_user.id)
        return jsonify({"message": "Unable to convert or store this GIF"}), 500

    return jsonify({"id": gif.id, "gif_url": gif.gif_url, "size_bytes": len(gif_bytes)}), 201


@chat_bp.get("/chat/groups")
@token_required
def get_groups(current_user):
    memberships = ChatGroupMember.query.filter_by(user_id=current_user.id).all()
    groups = [db.session.get(ChatGroup, membership.group_id) for membership in memberships]
    payload = [_group_payload(group, current_user.id) for group in groups if group]
    payload.sort(key=lambda group: group["latest_message_at"] or "", reverse=True)
    return jsonify(payload)


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


@chat_bp.patch("/chat/groups/<int:group_id>")
@token_required
def update_group(current_user, group_id):
    group = db.session.get(ChatGroup, group_id)
    membership = _group_member(group_id, current_user.id)
    if not group or not membership:
        return jsonify({"message": "Group not found"}), 404
    if group.owner_id != current_user.id and not membership.is_admin:
        return jsonify({"message": "Only group admins can update group information"}), 403
    name = str((request.get_json(silent=True) or {}).get("name", "")).strip()
    if not name or len(name) > 80:
        return jsonify({"message": "Group name must be between 1 and 80 characters"}), 400
    previous_name = group.name
    if name == previous_name:
        return jsonify(_group_payload(group, current_user.id))
    group.name = name
    _add_group_system_message(
        group_id,
        current_user,
        "group_updated",
        old_name=previous_name,
        name=name,
    )
    db.session.commit()
    return jsonify(_group_payload(group, current_user.id))


@chat_bp.post("/chat/groups/<int:group_id>/members")
@token_required
def add_group_members(current_user, group_id):
    group = db.session.get(ChatGroup, group_id)
    membership = _group_member(group_id, current_user.id)
    if not group or not membership:
        return jsonify({"message": "Group not found"}), 404
    if group.owner_id != current_user.id and not membership.is_admin:
        return jsonify({"message": "Only group admins can add members"}), 403

    raw_user_ids = (request.get_json(silent=True) or {}).get("user_ids")
    if not isinstance(raw_user_ids, list) or not raw_user_ids:
        return jsonify({"message": "Select at least one member"}), 400
    try:
        user_ids = {int(user_id) for user_id in raw_user_ids}
    except (TypeError, ValueError):
        return jsonify({"message": "Member IDs must be valid"}), 400
    user_ids.discard(current_user.id)
    existing_ids = {
        row.user_id for row in ChatGroupMember.query.filter_by(group_id=group_id).all()
    }
    user_ids -= existing_ids
    if not user_ids:
        return jsonify({"message": "Choose users who are not already members"}), 400

    users = User.query.filter(
        User.id.in_(user_ids), User.active.is_(True), User.is_banned.is_(False)
    ).all()
    if len(users) != len(user_ids):
        return jsonify({"message": "One or more selected members are unavailable"}), 400
    db.session.add_all(
        ChatGroupMember(group_id=group_id, user_id=user.id) for user in users
    )
    _add_group_system_message(
        group_id,
        current_user,
        "members_added",
        members=[{"id": user.id, "username": user.username} for user in users],
    )
    db.session.commit()
    return jsonify({
        "added": [{**_user_payload(user, current_user.id), "is_admin": False} for user in users],
        "member_count": ChatGroupMember.query.filter_by(group_id=group_id).count(),
    }), 201


@chat_bp.delete("/chat/groups/<int:group_id>/members/<int:user_id>")
@token_required
def remove_group_member(current_user, group_id, user_id):
    group = db.session.get(ChatGroup, group_id)
    membership = _group_member(group_id, current_user.id)
    if not group or not membership:
        return jsonify({"message": "Group not found"}), 404
    if group.owner_id != current_user.id and not membership.is_admin:
        return jsonify({"message": "Only group admins can remove members"}), 403
    target = _group_member(group_id, user_id)
    if not target:
        return jsonify({"message": "Member not found"}), 404
    if target.user_id == group.owner_id or target.is_admin:
        return jsonify({"message": "Group admins cannot be removed"}), 403
    removed_user = target.user
    db.session.delete(target)
    _add_group_system_message(
        group_id,
        current_user,
        "member_removed",
        member={"id": removed_user.id, "username": removed_user.username},
    )
    db.session.commit()
    return jsonify({
        "removed": True,
        "user_id": user_id,
        "member_count": ChatGroupMember.query.filter_by(group_id=group_id).count(),
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
    contacts = User.query.filter(User.id.in_(ids)).all() if ids else []
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
    payload.sort(key=lambda contact: contact["latest_message_at"] or "", reverse=True)
    return jsonify(payload)


@chat_bp.get("/chat/unread-count")
@token_required
def get_unread_count(current_user):
    unread_count = Message.query.filter(
        Message.recipient_id == current_user.id,
        Message.sender_id != current_user.id,
        Message.is_read.is_(False),
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
    unread_count = Message.query.filter(
        Message.recipient_id == current_user.id,
        Message.sender_id != current_user.id,
        Message.is_read.is_(False),
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
        page_size = int(request.args.get("limit", CHAT_MESSAGE_LIMIT))
    except (TypeError, ValueError):
        page_size = CHAT_MESSAGE_LIMIT
    try:
        page_offset = int(request.args.get("offset", "0"))
    except (TypeError, ValueError):
        page_offset = 0
    page_size = max(1, min(page_size, 100))
    page_offset = max(0, page_offset)
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
        ).order_by(Message.created_at.desc()).offset(page_offset).limit(page_size).all()
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
        ).order_by(Message.created_at.desc()).offset(page_offset).limit(page_size).all()
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
        "is_read": bool(message.is_read),
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
    blocked_by = Block.query.filter_by(blocker_id=user_id, blocked_id=current_user.id).first() is not None
    return jsonify({"blocked": blocked, "blocked_by": blocked_by})


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
    recipient = None if group_id else db.session.get(User, recipient_id)
    if not group_id and not recipient:
        return jsonify({"message": "A valid recipient and message are required"}), 400
    if (not content and not media_url) or len(content) > 2000 or len(media_url) > 500:
        return jsonify({"message": "A valid recipient and message are required"}), 400
    if not group_id and (Block.query.filter_by(blocker_id=recipient_id, blocked_id=current_user.id).first() or Block.query.filter_by(blocker_id=current_user.id, blocked_id=recipient_id).first()):
        return jsonify({"message": "Messaging is unavailable for this contact"}), 403
    message = Message(
        sender_id=current_user.id,
        recipient_id=current_user.id if group_id else recipient_id,
        group_id=group_id or None,
        content=content,
        media_url=media_url,
        type=message_type,
        file_name=file_name,
        file_size=file_size,
        is_read=bool(group_id),
    )
    db.session.add(message)
    db.session.commit()
    if recipient and recipient.email and not has_recent_presence(recipient):
        app = current_app._get_current_object()
        threading.Thread(
            target=_send_offline_chat_email,
            args=(
                app,
                recipient.id,
                current_user.id,
                recipient.email,
                current_user.display_name or current_user.username,
            ),
            daemon=True,
            name=f"chat-email-{recipient.id}-{current_user.id}",
        ).start()
    return jsonify({"id": message.id, "group_id": message.group_id, "content": message.content, "media_url": message.media_url, "type": message.type, "file_name": message.file_name, "file_size": message.file_size, "sender_id": message.sender_id, "created_at": f"{message.created_at.isoformat()}Z"}), 201
