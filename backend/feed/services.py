import json
import logging
import threading

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend import db

logger = logging.getLogger(__name__)
_embedding_model = None
_embedding_model_lock = threading.Lock()


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
