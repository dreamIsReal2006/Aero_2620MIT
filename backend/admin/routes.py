import json

from flask import g, jsonify, request

from backend import db
from backend.admin import admin_bp
from backend.admin.decorators import admin_required, login_required
from backend.models import AppealTicket, Comment, Like, ModerationLog, Post, Report, User


def success(data=None, status=200):
    return jsonify({"success": True, "data": data}), status


def failure(message, status=400):
    return jsonify({"success": False, "error": message}), status


def current_admin():
    return g.current_user


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_banned": bool(user.is_banned),
        "role": "admin" if user.is_admin or user.role == "admin" else "user",
    }


def serialize_post(post):
    try:
        images = json.loads(post.images_json or "[]")
    except (TypeError, ValueError):
        images = []
    return {
        "id": post.id,
        "content": post.content,
        "images": images,
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
            target = serialize_user(user)
    return {
        "id": report.id,
        "reporter": serialize_user(report.reporter),
        "target_type": report.target_type,
        "target_id": report.target_id,
        "target": target,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at.isoformat(),
    }


@admin_bp.get("/stats")
@login_required
@admin_required
def get_stats():
    return success({
        "total_users": db.session.query(db.func.count(User.id)).scalar() or 0,
        "total_posts": db.session.query(db.func.count(Post.id)).scalar() or 0,
        "pending_reports": db.session.query(db.func.count(Report.id)).filter(Report.status == "pending").scalar() or 0,
    })


@admin_bp.get("/search_users")
@login_required
@admin_required
def search_users():
    query = str(request.args.get("q", "")).strip()
    if not query:
        return success([])
    pattern = f"%{query}%"
    users = User.query.filter(
        (User.username.ilike(pattern)) | (User.email.ilike(pattern))
    ).order_by(User.username).limit(10).all()
    return success([serialize_user(user) for user in users])


@admin_bp.post("/users/<int:user_id>/toggle_ban")
@login_required
@admin_required
def toggle_ban(user_id):
    administrator = current_admin()
    if administrator.id == user_id:
        return failure("Administrators cannot ban themselves", 400)
    user = db.session.get(User, user_id)
    if not user:
        return failure("User not found", 404)
    try:
        user.is_banned = not user.is_banned
        db.session.add(ModerationLog(
            moderator_id=administrator.id,
            user_id=user.id,
            action="ban" if user.is_banned else "unban",
            reason="Admin dashboard action",
        ))
        db.session.commit()
        return success({"user": serialize_user(user)})
    except Exception:
        db.session.rollback()
        return failure("Unable to update user status", 500)


@admin_bp.post("/users/<int:user_id>/promote")
@login_required
@admin_required
def promote_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return failure("User not found", 404)
    if user.role == "admin" or user.is_admin:
        return success({"user": serialize_user(user)})
    try:
        user.role = "admin"
        user.is_admin = True
        db.session.commit()
        return success({"user": serialize_user(user)})
    except Exception:
        db.session.rollback()
        return failure("Unable to promote user", 500)


@admin_bp.post("/users/<int:user_id>/demote")
@login_required
@admin_required
def demote_user(user_id):
    administrator = current_admin()
    if administrator.id == user_id:
        return failure("Administrators cannot demote themselves", 400)
    user = db.session.get(User, user_id)
    if not user:
        return failure("User not found", 404)
    if user.role != "admin" and not user.is_admin:
        return success({"user": serialize_user(user)})
    try:
        user.role = "user"
        user.is_admin = False
        db.session.commit()
        return success({"user": serialize_user(user)})
    except Exception:
        db.session.rollback()
        return failure("Unable to revoke administrator permission", 500)


@admin_bp.get("/appeals")
@login_required
@admin_required
def get_appeals():
    appeals = AppealTicket.query.filter_by(status="pending").order_by(AppealTicket.created_at).all()
    return success([{
        "id": appeal.id,
        "user_id": appeal.user_id,
        "username": appeal.user.username,
        "content": appeal.content,
        "status": appeal.status,
        "created_at": appeal.created_at.isoformat(),
    } for appeal in appeals])


@admin_bp.post("/appeals")
@login_required
@admin_required
def create_appeal_from_admin():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    content = str(data.get("content", "")).strip()
    if not content or len(content) > 2000 or not db.session.get(User, user_id):
        return failure("A valid user_id and appeal content are required", 400)
    try:
        appeal = AppealTicket(user_id=user_id, content=content)
        db.session.add(appeal)
        db.session.commit()
        return success({"id": appeal.id, "status": appeal.status}, 201)
    except Exception:
        db.session.rollback()
        return failure("Unable to create appeal", 500)


@admin_bp.patch("/appeals/<int:appeal_id>/<action>")
@login_required
@admin_required
def review_appeal(appeal_id, action):
    if action not in {"approve", "reject"}:
        return failure("Invalid appeal action", 400)
    appeal = db.session.get(AppealTicket, appeal_id)
    if not appeal or appeal.status != "pending":
        return failure("Appeal not found or already reviewed", 404)
    try:
        appeal.status = "approved" if action == "approve" else "rejected"
        appeal.reviewed_at = db.func.now()
        if action == "approve":
            user = db.session.get(User, appeal.user_id)
            user.is_banned = False
            db.session.add(ModerationLog(
                moderator_id=current_admin().id,
                user_id=user.id,
                action="unban",
                reason="Appeal approved",
            ))
        db.session.commit()
        return success({"id": appeal.id, "status": appeal.status, "user_id": appeal.user_id})
    except Exception:
        db.session.rollback()
        return failure("Unable to review appeal", 500)


@admin_bp.get("/reports")
@login_required
@admin_required
def get_pending_reports():
    reports = Report.query.filter_by(status="pending").order_by(Report.created_at.desc()).all()
    return success([serialize_report(report) for report in reports])


@admin_bp.patch("/reports/<int:report_id>/dismiss")
@login_required
@admin_required
def dismiss_report(report_id):
    report = db.session.get(Report, report_id)
    if not report or report.status != "pending":
        return failure("Report not found or already processed", 404)
    try:
        report.status = "dismissed"
        db.session.commit()
        return success({"report_id": report.id, "status": report.status})
    except Exception:
        db.session.rollback()
        return failure("Unable to dismiss report", 500)


def _delete_post(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return failure("Post not found", 404)
    try:
        Comment.query.filter_by(post_id=post_id).delete(synchronize_session=False)
        Like.query.filter_by(post_id=post_id).delete(synchronize_session=False)
        Report.query.filter_by(target_type="post", target_id=post_id).delete(synchronize_session=False)
        db.session.delete(post)
        db.session.commit()
        return success({"post_id": post_id})
    except Exception:
        db.session.rollback()
        return failure("Unable to delete post", 500)


@admin_bp.delete("/posts/<int:post_id>")
@login_required
@admin_required
def force_delete_post(post_id):
    return _delete_post(post_id)