import json

from flask import jsonify, request

from backend import db
from backend.auth.routes import token_required
from backend.models import Follow, Post, Report, User
from backend.social import social_bp


def serialize_post(post):
    return {
        "id": post.id,
        "content": post.content,
        "images": json.loads(post.images_json or "[]"),
        "created_at": post.created_at.isoformat(),
    }


@social_bp.post("/social/follow/<int:user_id>")
@token_required
def toggle_follow(current_user, user_id):
    if current_user.id == user_id:
        return jsonify({"message": "You cannot follow yourself"}), 400

    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"message": "User not found"}), 404
    if target_user.is_banned:
        return jsonify({"message": "This user is banned"}), 403

    follow = Follow.query.filter_by(
        follower_id=current_user.id,
        following_id=user_id,
    ).first()
    if follow:
        db.session.delete(follow)
        is_following = False
    else:
        db.session.add(Follow(
            follower_id=current_user.id,
            following_id=user_id,
        ))
        is_following = True
    db.session.commit()

    followers_count = Follow.query.filter_by(following_id=user_id).count()
    following_count = Follow.query.filter_by(follower_id=user_id).count()
    return jsonify({
        "message": "User followed successfully" if is_following else "User unfollowed successfully",
        "user_id": user_id,
        "is_following": is_following,
        "followers_count": followers_count,
        "following_count": following_count,
    }), 200


@social_bp.get("/users/<int:user_id>/profile")
def get_profile(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    followers_count = Follow.query.filter_by(following_id=user_id).count()
    following_count = Follow.query.filter_by(follower_id=user_id).count()
    posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).all()
    return jsonify({
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio or "",
            "avatar_url": user.avatar_url or "",
            "created_at": user.created_at.isoformat(),
        },
        "followers_count": followers_count,
        "following_count": following_count,
        "posts": [serialize_post(post) for post in posts],
    }), 200


@social_bp.put("/users/me/profile")
@token_required
def update_my_profile(current_user):
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", current_user.username)).strip()
    email = str(data.get("email", current_user.email)).strip().lower()
    bio = str(data.get("bio", "")).strip()
    avatar_url = str(data.get("avatar_url", "")).strip()
    if len(username) < 3 or len(username) > 30 or not username.replace("_", "").isalnum():
        return jsonify({"message": "Username must be 3-30 letters, numbers, or underscores"}), 400
    if "@" not in email or len(email) > 254:
        return jsonify({"message": "Invalid email address"}), 400
    duplicate = User.query.filter(
        ((User.username.ilike(username)) | (User.email.ilike(email))) &
        (User.id != current_user.id)
    ).first()
    if duplicate:
        return jsonify({"message": "Username or email is already registered"}), 409
    if len(bio) > 150:
        return jsonify({"message": "Bio must be 150 characters or fewer"}), 400
    if len(avatar_url) > 500:
        return jsonify({"message": "Avatar URL is too long"}), 400

    current_user.username = username
    current_user.email = email
    current_user.bio = bio
    current_user.avatar_url = avatar_url
    db.session.commit()
    return jsonify({
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "bio": current_user.bio,
            "avatar_url": current_user.avatar_url,
            "is_admin": current_user.is_admin,
            "is_banned": current_user.is_banned,
            "is_private": current_user.is_private,
            "show_online_status": current_user.show_online_status,
        },
    }), 200


@social_bp.get("/users/me/profile")
@token_required
def get_my_profile(current_user):
    return jsonify({
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "bio": current_user.bio or "",
            "avatar_url": current_user.avatar_url or "",
            "is_admin": current_user.is_admin,
            "is_banned": current_user.is_banned,
            "is_private": current_user.is_private,
            "show_online_status": current_user.show_online_status,
        }
    }), 200


@social_bp.patch("/settings/privacy")
@token_required
def update_privacy_settings(current_user):
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("is_private"), bool) or not isinstance(data.get("show_online_status"), bool):
        return jsonify({"message": "Privacy settings must be boolean values"}), 400
    current_user.is_private = data["is_private"]
    current_user.show_online_status = data["show_online_status"]
    db.session.commit()
    return jsonify({
        "is_private": current_user.is_private,
        "show_online_status": current_user.show_online_status,
    }), 200


@social_bp.post("/reports")
@token_required
def create_report(current_user):
    data = request.get_json(silent=True) or {}
    target_type = str(data.get("target_type", "")).strip().lower()
    reason = str(data.get("reason", "")).strip()
    try:
        target_id = int(data.get("target_id"))
    except (TypeError, ValueError):
        target_id = 0

    if target_type not in {"post", "user"}:
        return jsonify({"message": "target_type must be post or user"}), 400
    if target_id <= 0 or not reason or len(reason) > 1000:
        return jsonify({"message": "target_id and a valid reason are required"}), 400
    if target_type == "post" and not db.session.get(Post, target_id):
        return jsonify({"message": "Post not found"}), 404
    if target_type == "user" and not db.session.get(User, target_id):
        return jsonify({"message": "User not found"}), 404

    report = Report(
        reporter_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        status="pending",
    )
    db.session.add(report)
    db.session.commit()
    return jsonify({
        "message": "Report submitted successfully",
        "report": {
            "id": report.id,
            "reporter_id": report.reporter_id,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "reason": report.reason,
            "status": report.status,
            "created_at": report.created_at.isoformat(),
        },
    }), 201
