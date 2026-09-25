import json
import datetime as dt
import logging
import math
import base64
import threading
import time
from pathlib import Path

from flask import current_app, jsonify, request
from sqlalchemy import false, func, or_, text
from sqlalchemy.orm import contains_eager, load_only
from werkzeug.utils import secure_filename

from backend import db
from backend.auth.routes import optional_token, token_required
from backend.feed import feed_bp
from backend.models import (
    Comment,
    CommentLike,
    Follow,
    Like,
    Message,
    Notification,
    Post,
    Report,
    User,
    UserInteraction,
)
from backend.mentions import add_mention_notifications
from backend.privacy import visible_author_ids as get_visible_author_ids
from backend.presence import is_user_online
from backend.storage import upload_file_to_supabase
from backend.feed.services import generate_post_embedding, save_post_embedding

ALLOWED_MEDIA_TYPES = {
    "jpg": "image/", "jpeg": "image/", "png": "image/", "webp": "image/", "gif": "image/",
    "avif": "image/", "heic": "image/", "heif": "image/",
    "mp4": "video/", "webm": "video/", "mov": "video/", "m4v": "video/",
}

HDR_IMAGE_EXTENSIONS = {"avif", "heic", "heif"}
HDR_VIDEO_EXTENSIONS = {"mp4", "webm", "mov", "m4v"}
VIDEO_UPLOAD_LIMIT = 1024 * 1024 * 1024
POST_CACHE_TTL_SECONDS = 15
_post_response_cache = {}
_post_cache_lock = threading.Lock()
logger = logging.getLogger(__name__)


def apply_diversity_filter(posts):
    selected = []
    remaining = list(posts)
    seen_authors = set()
    while remaining:
        next_post = next(
            (post for post in remaining if post.user_id not in seen_authors),
            remaining[0],
        )
        remaining.remove(next_post)
        selected.append(next_post)
        seen_authors.add(next_post.user_id)
    return selected


def _for_you_candidate_ids(user_id, limit):
    return db.session.execute(
        text("SELECT id FROM get_for_you_feed(:user_id, :limit_num)"),
        {"user_id": user_id, "limit_num": limit},
    ).scalars().all()


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
        follower_id=current_user_id, following_id=post.user_id, status="approved"
    ).first() is not None
    share_count = UserInteraction.query.filter(
        UserInteraction.post_id == post.id,
        UserInteraction.type.in_(["share", "copy"]),
    ).count()
    hours_ago = max(0, (dt.datetime.utcnow() - post.created_at).total_seconds() / 3600)
    score = (likes_count + comments_count * 3 + share_count * 2) / math.pow(hours_ago + 2, 1.5)
    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": post.author.username,
        "role": post.author.role if post.author.role in {"admin", "moderator", "user"} else "user",
        "avatar_url": post.author.avatar_url or "",
        "is_online": is_user_online(post.author, current_user_id),
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
        "created_at": f"{post.created_at.isoformat()}Z",
    }


def optimized_post_payload(
    post,
    current_user_id,
    likes_count,
    comments_count,
    share_count,
    liked_ids,
    bookmarked_ids,
    followed_ids,
):
    hours_ago = max(0, (dt.datetime.utcnow() - post.created_at).total_seconds() / 3600)
    score = (likes_count + comments_count * 3 + share_count * 2) / math.pow(hours_ago + 2, 1.5)
    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": post.author.username,
        "role": post.author.role if post.author.role in {"admin", "moderator", "user"} else "user",
        "avatar_url": post.author.avatar_url or "",
        "is_online": is_user_online(post.author, current_user_id),
        "content": post.content,
        "images": json.loads(post.images_json or "[]"),
        "likes_count": likes_count,
        "comments_count": comments_count,
        "is_liked": post.id in liked_ids,
        "is_bookmarked": post.id in bookmarked_ids,
        "is_following": post.user_id in followed_ids,
        "parent_id": post.parent_id,
        "type": post.type,
        "likes": likes_count,
        "comments": comments_count,
        "ranking_score": score,
        "created_at": f"{post.created_at.isoformat()}Z",
    }


def visible_posts_query(current_user):
    author_ids = get_visible_author_ids(current_user)
    return Post.query.join(User).filter(
        or_(
            User.is_private.is_(False),
            User.id.in_(author_ids),
        )
    )


def _pagination():
    page = max(request.args.get("page", 1, type=int) or 1, 1)
    limit = min(max(request.args.get("limit", 10, type=int) or 10, 1), 10)
    return page, limit, (page - 1) * limit


def _decode_post_cursor(value):
    if not value:
        return None
    try:
        decoded = base64.urlsafe_b64decode(str(value).encode()).decode()
        timestamp, post_id = decoded.rsplit("|", 1)
        created_at = dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if created_at.tzinfo:
            created_at = created_at.astimezone(dt.timezone.utc).replace(tzinfo=None)
        return created_at, int(post_id)
    except (ValueError, TypeError, UnicodeDecodeError):
        return None


def _encode_post_cursor(post):
    value = f"{post.created_at.isoformat()}Z|{post.id}"
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def _cached_posts(cache_key):
    now = time.monotonic()
    with _post_cache_lock:
        cached = _post_response_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]
        if cached:
            _post_response_cache.pop(cache_key, None)
    return None


def _cache_posts(cache_key, posts):
    with _post_cache_lock:
        if len(_post_response_cache) >= 128:
            oldest_key = min(_post_response_cache, key=lambda key: _post_response_cache[key][0])
            _post_response_cache.pop(oldest_key, None)
        _post_response_cache[cache_key] = (time.monotonic() + POST_CACHE_TTL_SECONDS, posts)


def async_generate_embedding(app, post_id, content):
    with app.app_context():
        try:
            embedding = generate_post_embedding(content)
            save_post_embedding(post_id, embedding)
        except Exception:
            logger.exception("Unable to generate embedding for post %s", post_id)
            db.session.rollback()
        finally:
            db.session.remove()


@feed_bp.get("/search")
@token_required
def search(current_user):
    query = str(request.args.get("q", "")).strip()
    if not query:
        return jsonify({"users": [], "posts": []})
    pattern = f"%{query}%"
    followed_ids = get_visible_author_ids(current_user)
    users = User.query.filter(
        User.username.ilike(pattern),
        (User.is_private.is_(False)) | User.id.in_(followed_ids),
    ).order_by(User.username).limit(5).all()
    posts = Post.query.join(User).filter(
        Post.content.ilike(pattern),
        (User.is_private.is_(False)) | User.id.in_(followed_ids),
    ).distinct().order_by(Post.created_at.desc()).limit(5).all()
    return jsonify({
        "users": [{"id": user.id, "username": user.username, "email": user.email, "avatar_url": user.avatar_url or ""} for user in users],
        "posts": [{"id": post.id, "content": post.content, "username": post.author.username} for post in posts],
    })


@feed_bp.get("/posts")
@optional_token
def get_posts(current_user):
    requested_limit = request.args.get("limit", 10, type=int) or 10
    limit = min(max(requested_limit, 1), 15)
    cursor = _decode_post_cursor(request.args.get("cursor", ""))
    feed_type = str(request.args.get("feed_type", "for_you")).strip().lower()
    author_id = request.args.get("author_id", type=int)
    cache_key = (current_user.id if current_user else None, feed_type, author_id, request.args.get("cursor", ""), limit)
    cached = _cached_posts(cache_key)
    if cached is not None:
        return jsonify(cached)

    excluded_ids = {
        post_id for (post_id,) in db.session.query(UserInteraction.post_id).filter_by(
            user_id=current_user.id, type="not_interested"
        ).all()
    } if current_user else set()
    followed_ids = {
        following_id for (following_id,) in db.session.query(Follow.following_id).filter_by(
            follower_id=current_user.id, status="approved"
        ).all()
    } if current_user else set()

    recommendation_ids = None
    if current_user and feed_type == "for_you" and author_id is None and not cursor:
        try:
            recommendation_ids = _for_you_candidate_ids(current_user.id, limit * 3 + 1)
        except Exception:
            db.session.rollback()
            logger.exception("For You feed function is unavailable; using default feed")

    like_counts = db.session.query(
        Like.post_id.label("post_id"),
        func.count(Like.id).label("likes_count"),
    ).group_by(Like.post_id).subquery()
    comment_counts = db.session.query(
        Comment.post_id.label("post_id"),
        func.count(Comment.id).label("comments_count"),
    ).group_by(Comment.post_id).subquery()
    share_counts = db.session.query(
        UserInteraction.post_id.label("post_id"),
        func.count(UserInteraction.id).label("share_count"),
    ).filter(UserInteraction.type.in_(["share", "copy"])).group_by(
        UserInteraction.post_id
    ).subquery()

    posts_query = visible_posts_query(current_user).options(
        load_only(
            Post.id,
            Post.user_id,
            Post.content,
            Post.images_json,
            Post.created_at,
            Post.parent_id,
            Post.type,
        ),
        contains_eager(Post.author).load_only(
            User.id,
            User.username,
            User.role,
            User.avatar_url,
            User.show_online_status,
            User.last_seen_at,
        ),
    )
    if excluded_ids:
        posts_query = posts_query.filter(~Post.id.in_(excluded_ids))
    if cursor:
        cursor_created_at, cursor_id = cursor
        posts_query = posts_query.filter(
            (Post.created_at < cursor_created_at) |
            ((Post.created_at == cursor_created_at) & (Post.id < cursor_id))
        )
    if author_id is not None:
        posts_query = posts_query.filter(Post.user_id == author_id)
    elif feed_type == "following":
        posts_query = posts_query.filter(Post.user_id.in_(followed_ids)) if followed_ids else posts_query.filter(false())
    elif recommendation_ids is not None:
        posts_query = posts_query.filter(Post.id.in_(recommendation_ids))

    rows = posts_query.outerjoin(like_counts, like_counts.c.post_id == Post.id).outerjoin(
        comment_counts, comment_counts.c.post_id == Post.id
    ).outerjoin(share_counts, share_counts.c.post_id == Post.id).add_columns(
        func.coalesce(like_counts.c.likes_count, 0).label("likes_count"),
        func.coalesce(comment_counts.c.comments_count, 0).label("comments_count"),
        func.coalesce(share_counts.c.share_count, 0).label("share_count"),
    ).order_by(Post.created_at.desc(), Post.id.desc()).limit(
        max(limit + 1, limit * 3) if recommendation_ids is not None else limit + 1
    ).all()
    rows_have_more = len(rows) > limit

    if recommendation_ids is not None:
        order = {post_id: index for index, post_id in enumerate(recommendation_ids)}
        rows.sort(key=lambda row: order.get(row[0].id, len(order)))
        diverse_posts = apply_diversity_filter([row[0] for row in rows])[:limit]
        row_by_post_id = {row[0].id: row for row in rows}
        rows = [row_by_post_id[post.id] for post in diverse_posts]

    has_more = rows_have_more
    rows = rows[:limit]

    post_ids = [post.id for post, _, _, _ in rows]
    liked_ids = {
        post_id for (post_id,) in db.session.query(Like.post_id).filter(
            Like.user_id == current_user.id, Like.post_id.in_(post_ids)
        ).all()
    } if current_user and post_ids else set()
    bookmarked_ids = {
        post_id for (post_id,) in db.session.query(UserInteraction.post_id).filter(
            UserInteraction.user_id == current_user.id,
            UserInteraction.type == "bookmark",
            UserInteraction.post_id.in_(post_ids),
        ).all()
    } if current_user and post_ids else set()
    viewer_id = current_user.id if current_user else None
    posts = [
        optimized_post_payload(
            post,
            viewer_id,
            int(likes_count),
            int(comments_count),
            int(share_count),
            liked_ids,
            bookmarked_ids,
            followed_ids,
        )
        for post, likes_count, comments_count, share_count in rows
    ]
    next_cursor = _encode_post_cursor(rows[-1][0]) if has_more and rows else None
    response = {"posts": posts, "next_cursor": next_cursor, "has_more": has_more}
    _cache_posts(cache_key, response)
    return jsonify(response)


@feed_bp.post("/uploads")
@token_required
def upload_media(current_user):
    file = request.files.get("file")
    extension = Path(secure_filename((file.filename or "") if file else "")).suffix.lower().lstrip(".")
    expected_mime = ALLOWED_MEDIA_TYPES.get(extension)
    mime = (file.mimetype or "").lower() if file else ""
    allowed_mimes = {
        "heic": {"image/heic", "image/heif"}, "heif": {"image/heic", "image/heif"},
        "mp4": {"video/mp4", "video/hevc"}, "mov": {"video/quicktime", "video/hevc"},
    }
    valid_mime = mime in allowed_mimes.get(extension, set()) or (expected_mime and mime.startswith(expected_mime))
    if not valid_mime and mime in {"", "application/octet-stream"}:
        valid_mime = bool(expected_mime)
    if not file or not file.filename or not expected_mime or not valid_mime:
        return jsonify({"message": "Supported media: JPG, PNG, WEBP, HEIC, HEIF, MP4, WEBM, MOV, or M4V"}), 400
    if extension in HDR_VIDEO_EXTENSIONS and request.content_length and request.content_length > VIDEO_UPLOAD_LIMIT:
        return jsonify({"message": "Video files must be 1 GB or smaller"}), 413
    try:
        folder = request.form.get("folder", "posts")
        public_url = upload_file_to_supabase(file, folder)
    except (RuntimeError, ValueError) as error:
        return jsonify({"message": str(error)}), 500
    return jsonify({
        "url": public_url,
        "media_kind": "video" if extension in HDR_VIDEO_EXTENSIONS else "image",
        "hdr_candidate": extension in HDR_IMAGE_EXTENSIONS or extension in HDR_VIDEO_EXTENSIONS,
        "original_preserved": True,
    }), 201


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
    db.session.flush()
    add_mention_notifications(content, current_user, post.id, "post")
    db.session.commit()
    if content:
        app = current_app._get_current_object()
        threading.Thread(
            target=async_generate_embedding,
            args=(app, post.id, content),
            daemon=True,
            name=f"post-embedding-{post.id}",
        ).start()
    return jsonify(post_payload(post, current_user.id)), 201


@feed_bp.delete("/posts/<post_id>")
@token_required
def delete_post(current_user, post_id):
    post = db.session.get(Post, post_id)
    effective_role = "admin" if current_user.is_admin else current_user.role
    can_moderate = effective_role in {"admin", "moderator"}
    if not post or (post.user_id != current_user.id and not can_moderate):
        post = None
    if not post:
        return jsonify({"message": "You are not authorized to delete this post"}), 403

    comment_ids = [
        comment.id
        for comment in Comment.query.filter_by(post_id=post.id).all()
    ]
    if comment_ids:
        CommentLike.query.filter(CommentLike.comment_id.in_(comment_ids)).delete(
            synchronize_session=False
        )
    UserInteraction.query.filter_by(post_id=post.id).delete(synchronize_session=False)
    Like.query.filter_by(post_id=post.id).delete(synchronize_session=False)
    Notification.query.filter_by(post_id=post.id).delete(synchronize_session=False)
    Message.query.filter_by(post_id=post.id).delete(synchronize_session=False)
    Report.query.filter(
        Report.target_type == "post",
        Report.target_id == post.id,
    ).delete(synchronize_session=False)
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
    db.session.add(UserInteraction(user_id=current_user.id, post_id=original.id, type="repost"))
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


@feed_bp.get("/posts/bookmarked")
@token_required
def get_bookmarked_posts(current_user):
    _, limit, offset = _pagination()
    bookmarked_ids = [
        interaction.post_id
        for interaction in UserInteraction.query.filter_by(
            user_id=current_user.id, type="bookmark"
        ).order_by(UserInteraction.id.desc()).limit(limit).offset(offset).all()
    ]
    if not bookmarked_ids:
        return jsonify([]), 200
    posts = visible_posts_query(current_user).filter(
        Post.id.in_(set(bookmarked_ids))
    ).distinct().order_by(Post.created_at.desc()).limit(limit).offset(offset).all()
    return jsonify([post_payload(post, current_user.id) for post in posts]), 200


@feed_bp.route("/posts/<int:post_id>/bookmark", methods=["POST", "DELETE"])
@token_required
def bookmark_post(current_user, post_id):
    if not db.session.get(Post, post_id):
        return jsonify({"message": "Post not found"}), 404
    interaction = UserInteraction.query.filter_by(
        user_id=current_user.id, post_id=post_id, type="bookmark"
    ).first()

    if request.method == "DELETE":
        if interaction:
            db.session.delete(interaction)
            db.session.commit()
            return jsonify({"bookmarked": False, "post_id": post_id}), 200
        return jsonify({"bookmarked": False, "post_id": post_id, "message": "Bookmark not found"}), 200

    if interaction:
        db.session.delete(interaction)
        bookmarked = False
    else:
        db.session.add(UserInteraction(user_id=current_user.id, post_id=post_id, type="bookmark"))
        bookmarked = True
    db.session.commit()
    return jsonify({"bookmarked": bookmarked, "post_id": post_id}), 200


@feed_bp.get("/bookmarks")
@token_required
def get_bookmarks(current_user):
    _, limit, offset = _pagination()
    interactions = UserInteraction.query.filter_by(
        user_id=current_user.id,
        type="bookmark",
    ).order_by(UserInteraction.id.desc()).limit(limit).offset(offset).all()

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
        db.session.add(UserInteraction(user_id=current_user.id, post_id=post_id, type="not_interested"))
        db.session.commit()
    return jsonify({"feedback": "not_interested"}), 200


@feed_bp.post("/posts/<int:post_id>/share-stats")
@token_required
def share_stats(current_user, post_id):
    if not db.session.get(Post, post_id):
        return jsonify({"message": "Post not found"}), 404
    action = str((request.get_json(silent=True) or {}).get("action", "share")).lower()
    if action not in {"share", "copy"}:
        return jsonify({"message": "Action must be share or copy"}), 400
    db.session.add(UserInteraction(user_id=current_user.id, post_id=post_id, type=action))
    db.session.commit()
    return jsonify({"recorded": action}), 201


@feed_bp.post("/posts/<int:post_id>/share")
@token_required
def send_post_to_user(current_user, post_id):
    data = request.get_json(silent=True) or {}
    post = db.session.get(Post, post_id)
    recipient_id = data.get("recipient_id")
    try:
        recipient_id = int(recipient_id) if recipient_id is not None else 0
    except (TypeError, ValueError):
        recipient_id = 0
    recipient_name = str(data.get("username", "")).strip()
    recipient = db.session.get(User, recipient_id) if recipient_id else None
    if not recipient and recipient_name:
        recipient = User.query.filter(User.username.ilike(recipient_name)).first()
    if not post or not recipient:
        return jsonify({"message": "Post or recipient not found"}), 404
    db.session.add(Message(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        post_id=post.id,
        content=f"Shared post from @{current_user.username}",
        type="post_share",
        media_url="",
    ))
    db.session.add(Notification(
        recipient_id=recipient.id,
        actor_id=current_user.id,
        post_id=post.id,
        type="share",
        message=f"@{current_user.username} shared a post with you",
    ))
    db.session.add(UserInteraction(user_id=current_user.id, post_id=post.id, type="share"))
    db.session.commit()
    return jsonify({"message": "Post shared successfully", "recipient": recipient.username}), 201
