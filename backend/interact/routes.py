from flask import jsonify, session, request

from backend import db
from backend.interact import interact_bp
from backend.models import User, Post, Like, Comment


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


@interact_bp.route("/posts/<int:post_id>/comments", methods=["POST"])
def create_comment(post_id):
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

    # Get JSON data from the request
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "Request body must contain JSON"
        }), 400

    content = data.get("content")

    # Validate comment content
    if not content or not content.strip():
        return jsonify({
            "error": "Comment content is required"
        }), 400

    content = content.strip()

    # Create the comment
    comment = Comment(
        user_id=user_id,
        post_id=post_id,
        content=content,
        parent_id=None
    )

    db.session.add(comment)
    db.session.commit()

    return jsonify({
        "message": "Comment created successfully",
        "comment": {
            "id": comment.id,
            "user_id": comment.user_id,
            "post_id": comment.post_id,
            "content": comment.content,
            "parent_id": comment.parent_id,
            "created_at": comment.created_at.isoformat()
        }
    }), 201


@interact_bp.route(
    "/comments/<int:comment_id>/replies",
    methods=["POST"]
)
def create_reply(comment_id):
    # Check whether a user is logged in
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "error": "Authentication required"
        }), 401

    # Check that the parent comment exists
    parent_comment = db.session.get(Comment, comment_id)

    if not parent_comment:
        return jsonify({
            "error": "Comment not found"
        }), 404

    # Get JSON data from the request
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "Request body must contain JSON"
        }), 400

    content = data.get("content")

    # Validate reply content
    if not content or not content.strip():
        return jsonify({
            "error": "Reply content is required"
        }), 400

    content = content.strip()

    # Create the reply
    reply = Comment(
        user_id=user_id,
        post_id=parent_comment.post_id,
        content=content,
        parent_id=parent_comment.id
    )

    db.session.add(reply)
    db.session.commit()

    return jsonify({
        "message": "Reply created successfully",
        "comment": {
            "id": reply.id,
            "user_id": reply.user_id,
            "post_id": reply.post_id,
            "content": reply.content,
            "parent_id": reply.parent_id,
            "created_at": reply.created_at.isoformat()
        }
    }), 201


@interact_bp.route(
    "/posts/<int:post_id>/comments",
    methods=["GET"]
)
def get_comments(post_id):
    # Check that the post exists
    post = db.session.get(Post, post_id)

    if not post:
        return jsonify({
            "error": "Post not found"
        }), 404

    # Get all comments belonging to this post
    comments = Comment.query.filter_by(
        post_id=post_id
    ).order_by(
        Comment.created_at.asc()
    ).all()

    # Convert comments into a dictionary
    comment_map = {}

    for comment in comments:
        comment_map[comment.id] = {
            "id": comment.id,
            "user_id": comment.user_id,
            "post_id": comment.post_id,
            "content": comment.content,
            "parent_id": comment.parent_id,
            "created_at": comment.created_at.isoformat(),
            "replies": []
        }

    # Build the tree
    root_comments = []

    for comment in comments:
        current_comment = comment_map[comment.id]

        if comment.parent_id is None:
            root_comments.append(current_comment)
        else:
            parent = comment_map.get(comment.parent_id)

            if parent:
                parent["replies"].append(current_comment)

    return jsonify({
        "post_id": post_id,
        "comments": root_comments
    }), 200
