from backend import db
from backend.models import Follow, User


def can_view_user_content(viewer, target_user):
    """Return whether viewer may see posts/content owned by target_user."""
    if not viewer or not target_user:
        return False
    if viewer.id == target_user.id or not target_user.is_private:
        return True
    return db.session.query(Follow.id).filter(
        Follow.follower_id == viewer.id,
        Follow.following_id == target_user.id,
        Follow.status == "approved",
    ).first() is not None


def visible_author_ids(viewer):
    followed_ids = db.session.query(Follow.following_id).filter(
        Follow.follower_id == viewer.id,
        Follow.status == "approved",
    ).all()
    return [viewer.id, *(following_id for following_id, in followed_ids)]