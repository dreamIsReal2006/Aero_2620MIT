from flask import jsonify, session

from backend import db
from backend.interact import interact_bp
from backend.models import User, Post, Like


@interact_bp.route("/test", methods=["GET"])
def interact_test():
    return jsonify({
        "message": "Interaction Blueprint is working!"
    })


@interact_bp.route("/posts/<int:post_id>/like", methods=["POST"])
def like_post(post_id):
    # Check whether a user is logged in
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "error": "Authentication required"
        }), 401

    # Check that the post exists
    post = db.session.get(Post, post_id)

    if not post:
        return jsonify({
            "error": "Post not found"
        }), 404

    # Check whether this user has already liked the post
    existing_like = Like.query.filter_by(
        user_id=user_id,
        post_id=post_id
    ).first()

    if existing_like:
        return jsonify({
            "error": "Post already liked"
        }), 409

    # Create the like
    like = Like(
        user_id=user_id,
        post_id=post_id
    )

    db.session.add(like)
    db.session.commit()

    # Count the current likes
    like_count = Like.query.filter_by(
        post_id=post_id
    ).count()

    return jsonify({
        "message": "Post liked successfully",
        "post_id": post_id,
        "like_count": like_count
    }), 201


@interact_bp.route("/posts/<int:post_id>/like", methods=["DELETE"])
def unlike_post(post_id):
    # Check whether a user is logged in
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "error": "Authentication required"
        }), 401

    # Check that the post exists
    post = db.session.get(Post, post_id)

    if not post:
        return jsonify({
            "error": "Post not found"
        }), 404

    # Find the user's like
    existing_like = Like.query.filter_by(
        user_id=user_id,
        post_id=post_id
    ).first()

    if not existing_like:
        return jsonify({
            "error": "Post has not been liked"
        }), 404

    # Remove the like
    db.session.delete(existing_like)
    db.session.commit()

    # Count the remaining likes
    like_count = Like.query.filter_by(
        post_id=post_id
    ).count()

    return jsonify({
        "message": "Post unliked successfully",
        "post_id": post_id,
        "like_count": like_count
    }), 200
