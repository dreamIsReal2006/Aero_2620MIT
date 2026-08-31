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
from backend.models import Comment, Follow, Like, Notification, Post, User, UserInteraction

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
    bookmarked = current_user_id is not None and UserInteraction.query.filter_by(
        post_id=post.id, user_id=current_user_id, type="bookmark"
    ).first() is not None
    is_following = current_user_id is not None and Follow.query.filter_by(
        follower_id=current_user_id, following_id=post.user_id
    ).first() is not None
    share_count = UserInteraction.query.filter(
        UserInteraction.post_id == post.id,
        UserInteraction.type.in_(["share", "copy"]),
    ).count()
    hours_ago = max(0, (dt.datetime.utcnow() -
                    post.created_at).total_seconds() / 3600)
    score = (likes_count + comments_count * 3 + share_count * 2) / \
        math.pow(hours_ago + 2, 1.5)
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
        "is_bookmarked": bookmarked,
        "is_following": is_following,
        "parent_id": post.parent_id,
        "type": post.type,
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
    users = User.query.filter(User.username.ilike(
        pattern)).order_by(User.username).limit(5).all()
    posts = Post.query.join(User).filter(Post.content.ilike(
        pattern)).order_by(Post.created_at.desc()).limit(5).all()
    return jsonify({
        "users": [{"id": user.id, "username": user.username, "email": user.email} for user in users],
        "posts": [{"id": post.id, "content": post.content, "username": post.author.username} for post in posts],
    })


@feed_bp.get("/posts")
@token_required
def get_posts(current_user):
    excluded_ids = {
        interaction.post_id
        for interaction in UserInteraction.query.filter_by(
            user_id=current_user.id, type="not_interested"
        ).all()
    }
    posts = [
        post_payload(post, current_user.id)
        for post in Post.query.all()
        if post.id not in excluded_ids
    ]
    posts.sort(key=lambda post: post["ranking_score"], reverse=True)
    return jsonify(posts)


@feed_bp.post("/uploads")
@token_required
def upload_media(current_user):
    file = request.files.get("file")
    extension = Path(secure_filename(
        file.filename if file else "")).suffix.lower().lstrip(".")
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
    post_type = str(data.get("type", "original")).strip().lower()
    if post_type not in {"original", "repost", "quote"}:
        return jsonify({"message": "Invalid post type"}), 400
    post = Post(
        content=content,
        images_json=json.dumps(images),
        user_id=current_user.id,
        parent_id=data.get("parentId"),
        type=post_type,
    )
    db.session.add(post)
    db.session.commit()
    return jsonify(post_payload(post, current_user.id)), 201


@feed_bp.delete("/posts/<post_id>")
@token_required
def delete_post(current_user, post_id):
    post = db.session.get(Post, post_id)
    if not post or (post.user_id != current_user.id and not current_user.is_admin):
        post = None
    if not post:
        return jsonify({"message": "You are not authorized to delete this post"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted successfully"})


@feed_bp.post("/posts/<int:post_id>/repost")
@token_required
def repost_post(current_user, post_id):
    original = db.session.get(Post, post_id)
    if not original:
        return jsonify({"message": "Post not found"}), 404
    data = request.get_json(silent=True) or {}
    post_type = str(data.get("type", "repost")).strip().lower()
    if post_type not in {"repost", "quote"}:
        return jsonify({"message": "Repost type must be repost or quote"}), 400
    content = str(data.get("content", "")).strip()
    if post_type == "quote" and not content:
        return jsonify({"message": "Quote content is required"}), 400
    repost = Post(
        content=content,
        images_json="[]",
        user_id=current_user.id,
        parent_id=original.id,
        type=post_type,
    )
    db.session.add(repost)
    db.session.add(UserInteraction(user_id=current_user.id,
                   post_id=original.id, type="repost"))
    if original.user_id != current_user.id:
        db.session.add(Notification(
            recipient_id=original.user_id,
            actor_id=current_user.id,
            post_id=original.id,
            type=post_type,
            message=f"@{current_user.username} {post_type}ed your post",
        ))
    db.session.commit()
    return jsonify(post_payload(repost, current_user.id)), 201


@feed_bp.post("/posts/<int:post_id>/bookmark")
@token_required
def bookmark_post(current_user, post_id):
    ...
    db.session.commit()
    return jsonify({"bookmarked": bookmarked}), 200


@feed_bp.get("/bookmarks")
@token_required
def get_bookmarks(current_user):
    interactions = UserInteraction.query.filter_by(
        user_id=current_user.id,
        type="bookmark"
    ).all()

    posts = []

    for interaction in interactions:
        post = db.session.get(Post, interaction.post_id)

        if post:
            posts.append(post_payload(post, current_user.id))

    return jsonify(posts), 200


@feed_bp.post("/recommendations/feedback")
@token_required
def recommendation_feedback(current_user):
    data = request.get_json(silent=True) or {}
    try:
        post_id = int(data.get("postId"))
    except (TypeError, ValueError):
        post_id = 0
    if data.get("feedback") != "not_interested" or not db.session.get(Post, post_id):
        return jsonify({"message": "A valid postId and feedback are required"}), 400
    existing = UserInteraction.query.filter_by(
        user_id=current_user.id, post_id=post_id, type="not_interested"
    ).first()
    if not existing:
        db.session.add(UserInteraction(user_id=current_user.id,
                       post_id=post_id, type="not_interested"))
        db.session.commit()
    return jsonify({"feedback": "not_interested"}), 200


@feed_bp.post("/posts/<int:post_id>/share-stats")
@token_required
def share_stats(current_user, post_id):
    if not db.session.get(Post, post_id):
        return jsonify({"message": "Post not found"}), 404
    action = str((request.get_json(silent=True) or {}
                  ).get("action", "share")).lower()
    if action not in {"share", "copy"}:
        return jsonify({"message": "Action must be share or copy"}), 400
    db.session.add(UserInteraction(
        user_id=current_user.id, post_id=post_id, type=action))
    db.session.commit()
    return jsonify({"recorded": action}), 201


@feed_bp.post("/posts/<int:post_id>/share")
@token_required
def send_post_to_user(current_user, post_id):
    post = db.session.get(Post, post_id)
    recipient_name = str((request.get_json(silent=True)
                         or {}).get("username", "")).strip()
    recipient = User.query.filter(User.username.ilike(recipient_name)).first()
    if not post or not recipient:
        return jsonify({"message": "Post or recipient not found"}), 404
    db.session.add(Notification(
        recipient_id=recipient.id,
        actor_id=current_user.id,
        post_id=post.id,
        type="share",
        message=f"@{current_user.username} shared a post with you",
    ))
    db.session.add(UserInteraction(
        user_id=current_user.id, post_id=post.id, type="share"))
    db.session.commit()
    return jsonify({"message": "Post shared successfully", "recipient": recipient.username}), 201
