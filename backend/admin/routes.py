import json
from functools import wraps

from flask import jsonify

from backend import db
from backend.admin import admin_bp
from backend.auth.routes import token_required
from backend.models import Comment, Like, Post, Report, User


def admin_required(function):
    @wraps(function)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_admin:
            return jsonify({"message": "Administrator access required"}), 403
        return function(current_user, *args, **kwargs)

    return decorated


def serialize_post(post):
    return {
        "id": post.id,
        "content": post.content,
        "images": json.loads(post.images_json or "[]"),
        "created_at": post.created_at.isoformat(),
        "user_id": post.user_id,
        "username": post.author.username,
        "avatar_url": post.author.avatar_url or "",
    }


def serialize_report(report):
    target = None
    if report.target_type == "post":
        post = db.session.get(Post, report.target_id)
        if post:
            target = serialize_post(post)
    else:
        user = db.session.get(User, report.target_id)
        if user:
            target = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }

    return {
        "id": report.id,
        "reporter": {
            "id": report.reporter.id,
            "username": report.reporter.username,
            "email": report.reporter.email,
        },
        "target_type": report.target_type,
        "target_id": report.target_id,
        "target": target,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at.isoformat(),
    }


@admin_bp.get("/stats")
@admin_required
def get_stats(current_user):
    return jsonify({
        "users_count": User.query.count(),
        "posts_count": Post.query.count(),
        "pending_reports_count": Report.query.filter_by(status="pending").count(),
    }), 200


@admin_bp.get("/reports")
@admin_required
def get_pending_reports(current_user):
    reports = Report.query.filter_by(status="pending").order_by(Report.created_at.desc()).all()
    return jsonify([serialize_report(report) for report in reports]), 200


@admin_bp.patch("/reports/<int:report_id>/dismiss")
@admin_required
def dismiss_report(current_user, report_id):
    report = db.session.get(Report, report_id)
    if not report:
        return jsonify({"message": "Report not found"}), 404
    if report.status != "pending":
        return jsonify({"message": "Report has already been processed"}), 409
    report.status = "dismissed"
    db.session.commit()
    return jsonify({"message": "Report dismissed successfully", "report_id": report.id}), 200


def _delete_post(current_user, post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found"}), 404

    Comment.query.filter_by(post_id=post_id).delete(synchronize_session=False)
    Like.query.filter_by(post_id=post_id).delete(synchronize_session=False)
    Report.query.filter_by(target_type="post", target_id=post_id).delete(synchronize_session=False)
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted successfully", "post_id": post_id}), 200


@admin_bp.delete("/posts/<int:post_id>")
@admin_required
def force_delete_post(current_user, post_id):
    return _delete_post(current_user, post_id)


@admin_bp.post("/posts/<int:post_id>/delete")
@admin_required
def legacy_force_delete_post(current_user, post_id):
    return _delete_post(current_user, post_id)


@admin_bp.post("/users/<int:user_id>/ban")
@admin_required
def toggle_user_ban(current_user, user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    user.is_banned = not user.is_banned
    db.session.commit()
    return jsonify({
        "message": "User banned successfully" if user.is_banned else "User unbanned successfully",
        "user_id": user.id,
        "is_banned": user.is_banned,
    }), 200
