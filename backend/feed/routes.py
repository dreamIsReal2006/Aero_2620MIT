import json
import datetime as dt
import math
import uuid
from pathlib import Path

from flask import current_app, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from backend import db
from backend.auth.routes import token_required
from backend.feed import feed_bp
from backend.models import Comment, Like, Post, User

ALLOWED_MEDIA_TYPES = {
    "jpg": "image/", "jpeg": "image/", "png": "image/", "webp": "image/",
    "mp4": "video/", "webm": "video/", "mov": "video/",
}


def post_payload(post, current_user_id=None):
    likes_count = Like.query.filter_by(post_id=post.id).count()
    comments_count = Comment.query.filter_by(post_id=post.id).count()
    is_liked = current_user_id is not None and Like.query.filter_by(
        post_id=post.id, user_id=current_user_id
    ).first() is not None
    hours_ago = max(0, (dt.datetime.utcnow() - post.created_at).total_seconds() / 3600)
    score = (likes_count + comments_count * 3) / math.pow(hours_ago + 2, 1.5)
    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": post.author.username,
        "avatar_url": post.author.avatar_url or "",
        "content": post.content,
        "images": json.loads(post.images_json or "[]"),
        "likes_count": likes_count,
        "comments_count": comments_count,
        "is_liked": is_liked,
        "likes": likes_count,
        "comments": comments_count,
        "ranking_score": score,
        "created_at": post.created_at.isoformat(),
    }


@feed_bp.get("/search")
def search():
    query = str(request.args.get("q", "")).strip()
    if not query:
        return jsonify({"users": [], "posts": []})
    pattern = f"%{query}%"
    users = User.query.filter(User.username.ilike(pattern)).order_by(User.username).limit(5).all()
    posts = Post.query.join(User).filter(Post.content.ilike(pattern)).order_by(Post.created_at.desc()).limit(5).all()
    return jsonify({
        "users": [{"id": user.id, "username": user.username, "email": user.email} for user in users],
        "posts": [{"id": post.id, "content": post.content, "username": post.author.username} for post in posts],
    })


@feed_bp.get("/posts")
@token_required
def get_posts(current_user):
    posts = [
        post_payload(post, current_user.id)
        for post in Post.query.all()
    ]
    posts.sort(key=lambda post: post["ranking_score"], reverse=True)
    return jsonify(posts)


@feed_bp.post("/uploads")
@token_required
def upload_media(current_user):
    file = request.files.get("file")
    extension = Path(secure_filename(file.filename if file else "")).suffix.lower().lstrip(".")
    expected_mime = ALLOWED_MEDIA_TYPES.get(extension)
    if not file or not file.filename or not expected_mime or not (file.mimetype or "").startswith(expected_mime):
        return jsonify({"message": "Only JPG, PNG, JPEG, WEBP, MP4, WEBM, or MOV media are supported"}), 400
    filename = f"{uuid.uuid4().hex}.{extension}"
    file.save(Path(current_app.config["UPLOAD_FOLDER"]) / filename)
    return jsonify({"url": f"/uploads/{filename}"}), 201


@feed_bp.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)


@feed_bp.post("/posts")
@token_required
def create_post(current_user):
    data = request.get_json(silent=True) or {}
    content = str(data.get("content", "")).strip()
    images = data.get("images", [])
    if (not content and not images) or len(content) > 5000 or not isinstance(images, list) or len(images) > 10:
        return jsonify({"message": "Invalid post content or number of media files"}), 400
    post = Post(content=content, images_json=json.dumps(images), user_id=current_user.id)
    db.session.add(post)
    db.session.commit()
    return jsonify(post_payload(post, current_user.id)), 201


@feed_bp.delete("/posts/<post_id>")
@token_required
def delete_post(current_user, post_id):
    post = Post.query.filter_by(id=post_id, user_id=current_user.id).first()
    if not post:
        return jsonify({"message": "You are not authorized to delete this post"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted successfully"})
