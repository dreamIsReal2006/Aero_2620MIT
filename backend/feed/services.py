import json
import logging
import re
import threading

from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend import db
from backend.models import Hashtag, PostHashtag, UserHashtagInterest

logger = logging.getLogger(__name__)
_embedding_model = None
_embedding_model_lock = threading.Lock()
HASHTAG_PATTERN = re.compile(r"(?<![A-Za-z0-9_])#([\w][\w.-]{0,99})", re.UNICODE)


def extract_hashtags(content):
    return {match.group(1).casefold() for match in HASHTAG_PATTERN.finditer(content or "")}


def index_post_hashtags(post_id, content):
    for tag in extract_hashtags(content):
        db.session.execute(
            pg_insert(Hashtag).values(tag=tag).on_conflict_do_nothing(index_elements=[Hashtag.tag])
        )
        hashtag_id = db.session.query(Hashtag.id).filter_by(tag=tag).scalar()
        if hashtag_id:
            db.session.execute(
                pg_insert(PostHashtag).values(post_id=post_id, hashtag_id=hashtag_id)
                .on_conflict_do_nothing(index_elements=[PostHashtag.post_id, PostHashtag.hashtag_id])
            )


def update_hashtag_interests(user_id, post_id, amount=0.2):
    try:
        hashtag_ids = db.session.query(PostHashtag.hashtag_id).filter_by(post_id=post_id).all()
        for (hashtag_id,) in hashtag_ids:
            db.session.execute(
                pg_insert(UserHashtagInterest)
                .values(user_id=user_id, hashtag_id=hashtag_id, weight=amount)
                .on_conflict_do_update(
                    index_elements=[UserHashtagInterest.user_id, UserHashtagInterest.hashtag_id],
                    set_={
                        "weight": func.least(UserHashtagInterest.weight + amount, 1.0),
                        "updated_at": func.now(),
                    },
                )
            )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Unable to update hashtag interests for user %s", user_id)


def get_for_you_candidate_ids(user_id, limit):
    return db.session.execute(
        text(
            "SELECT p.id FROM posts p "
            "JOIN users u ON u.id = :user_id "
            "LEFT JOIN LATERAL ("
            " SELECT AVG(interest.weight) AS match_score "
            " FROM post_hashtags post_tag "
            " JOIN user_hashtag_interests interest ON interest.hashtag_id = post_tag.hashtag_id "
            " WHERE post_tag.post_id = p.id AND interest.user_id = u.id"
            ") tag_score ON TRUE "
            "ORDER BY ("
            " 0.5 * CASE WHEN p.embedding IS NULL OR u.interest_embedding IS NULL THEN 0.0 "
            " ELSE GREATEST(1.0 - (p.embedding <=> u.interest_embedding), 0.0) END "
            " + 0.3 * COALESCE(tag_score.match_score, 0.0) "
            " + 0.2 * EXP(-GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)), 0.0) / 172800.0)"
            ") DESC, p.created_at DESC "
            "LIMIT :limit"
        ),
        {"user_id": user_id, "limit": max(int(limit), 1)},
    ).scalars().all()


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        with _embedding_model_lock:
            if _embedding_model is None:
                from sentence_transformers import SentenceTransformer

                _embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _embedding_model


def generate_post_embedding(text_content):
    """Return a 384-dimensional embedding for post text."""
    content = str(text_content or "").strip()
    if not content:
        return None
    embedding = _get_embedding_model().encode(content, normalize_embeddings=True)
    values = [float(value) for value in embedding.tolist()]
    if len(values) != 384:
        raise ValueError("The configured embedding model must return 384 values")
    return values


def _embedding_literal(values):
    return "[" + ",".join(str(float(value)) for value in values) + "]"


def save_post_embedding(post_id, embedding):
    if not embedding:
        return
    try:
        db.session.execute(text("SET LOCAL statement_timeout = 5000"))
        db.session.execute(
            text("UPDATE posts SET embedding = CAST(:embedding AS vector) WHERE id = :post_id"),
            {"embedding": _embedding_literal(embedding), "post_id": post_id},
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Unable to save embedding for post %s", post_id)
    finally:
        db.session.remove()


def update_interest_embedding(user_id, post_id):
    """Blend a positive post interaction into the user's interest vector."""
    try:
        row = db.session.execute(
            text(
                "SELECT p.embedding::text AS post_embedding, "
                "u.interest_embedding::text AS user_embedding "
                "FROM posts p CROSS JOIN users u "
                "WHERE p.id = :post_id AND u.id = :user_id"
            ),
            {"post_id": post_id, "user_id": user_id},
        ).mappings().first()
        if not row or not row["post_embedding"]:
            return False
        post_embedding = json.loads(row["post_embedding"])
        user_embedding = json.loads(row["user_embedding"]) if row["user_embedding"] else None
        if len(post_embedding) != 384:
            return False
        blended = post_embedding if not user_embedding else [
            0.85 * old + 0.15 * new
            for old, new in zip(user_embedding, post_embedding)
        ]
        db.session.execute(
            text(
                "UPDATE users SET interest_embedding = CAST(:embedding AS vector) "
                "WHERE id = :user_id"
            ),
            {"embedding": _embedding_literal(blended), "user_id": user_id},
        )
        db.session.commit()
        return True
    except (SQLAlchemyError, TypeError, ValueError, json.JSONDecodeError):
        db.session.rollback()
        logger.exception("Unable to update interest embedding for user %s", user_id)
        return False
