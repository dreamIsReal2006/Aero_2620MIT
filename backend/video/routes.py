from pathlib import Path

from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename

from backend.auth.routes import token_required
from backend.video import video_bp
from backend.models import Follow, Video, VideoComment, VideoLike
from backend import db


@video_bp.get("/videos")
@video_bp.get("/shorts")
@token_required
def get_videos(current_user):
    return jsonify(_video_payloads(current_user.id))


def _video_payloads(current_user_id):
    videos = Video.query.order_by(Video.created_at.desc()).limit(50).all()
    return [{
        "id": video.id,
        "video_url": video.video_url,
        "caption": video.caption,
        "track_name": video.track_name,
        "created_at": f"{video.created_at.isoformat()}Z",
        "author": {
            "id": video.author.id,
            "username": video.author.username,
            "avatar_url": video.author.avatar_url or "",
        },
        "likes_count": VideoLike.query.filter_by(video_id=video.id).count(),
        "is_liked": VideoLike.query.filter_by(video_id=video.id, user_id=current_user_id).first() is not None,
        "is_following": Follow.query.filter_by(follower_id=current_user_id, following_id=video.user_id).first() is not None,
    } for video in videos]


@video_bp.get("/reels")
@token_required
def get_reels(current_user):
    return jsonify(_video_payloads(current_user.id))


@video_bp.post("/shorts/upload")
@token_required
def upload_short(current_user):
    video_file = request.files.get("file")
    if not video_file or not video_file.filename:
        return jsonify({"success": False, "message": "A video file is required"}), 400
    extension = Path(secure_filename(video_file.filename)).suffix.lower()
    if extension not in {".mp4", ".webm"} or not (video_file.mimetype or "").startswith("video/"):
        return jsonify({"success": False, "message": "Only MP4 and WEBM videos are supported"}), 400
    filename = f"short_{current_user.id}_{__import__('uuid').uuid4().hex}{extension}"
    destination = Path(current_app.config["UPLOAD_FOLDER"]) / filename
    video_file.save(destination)
    return jsonify({"success": True, "video_url": f"/uploads/{filename}"}), 201


@video_bp.post("/videos")
@token_required
def create_video(current_user):
    data = request.get_json(silent=True) or {}
    video_url = str(data.get("video_url") or "").strip()
    if not video_url:
        return jsonify({"message": "Video URL is required"}), 400
    video = Video(
        user_id=current_user.id,
        video_url=video_url,
        caption=str(data.get("caption") or "").strip()[:2000],
        track_name=str(data.get("track_name") or "Original audio").strip()[:160],
    )
    db.session.add(video)
    db.session.commit()
    return jsonify({"id": video.id, "message": "Short video uploaded"}), 201


@video_bp.get("/shorts/<int:video_id>/comments")
@video_bp.get("/videos/<int:video_id>/comments")
@token_required
def get_video_comments(current_user, video_id):
    comments = VideoComment.query.filter_by(video_id=video_id).order_by(VideoComment.created_at.asc()).all()
    return jsonify([{"id": item.id, "username": item.author.username, "content": item.content, "media_url": item.media_url or "", "type": item.type or "text", "created_at": f"{item.created_at.isoformat()}Z"} for item in comments])


@video_bp.post("/shorts/<int:video_id>/comments")
@video_bp.post("/videos/<int:video_id>/comments")
@token_required
def create_video_comment(current_user, video_id):
    if not db.session.get(Video, video_id):
        return jsonify({"message": "Video not found"}), 404
    content = str((request.get_json(silent=True) or {}).get("content") or "").strip()
    data = request.get_json(silent=True) or {}
    media_url = str(data.get("media_url") or "").strip()
    message_type = "gif" if str(data.get("type") or "").lower() == "gif" and media_url else "text"
    if not content and not media_url:
        return jsonify({"message": "Comment is required"}), 400
    comment = VideoComment(video_id=video_id, user_id=current_user.id, content=content[:1000], media_url=media_url, type=message_type)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"id": comment.id, "username": current_user.username, "content": comment.content, "media_url": comment.media_url, "type": comment.type}), 201


@video_bp.post("/shorts/<int:video_id>/like")
@token_required
def like_short(current_user, video_id):
    if not db.session.get(Video, video_id):
        return jsonify({"message": "Video not found"}), 404
    existing = VideoLike.query.filter_by(user_id=current_user.id, video_id=video_id).first()
    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(VideoLike(user_id=current_user.id, video_id=video_id))
        liked = True
    db.session.commit()
    return jsonify({"liked": liked, "likes_count": VideoLike.query.filter_by(video_id=video_id).count()})
