CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION get_for_you_feed(
    user_id_param INT,
    limit_num INT DEFAULT 20
)
RETURNS SETOF posts AS $$
DECLARE
    user_vec vector(384);
BEGIN
    SELECT interest_embedding INTO user_vec
    FROM users
    WHERE id = user_id_param;

    IF user_vec IS NULL THEN
        RETURN QUERY
        SELECT p.*
        FROM posts p
        ORDER BY p.created_at DESC
        LIMIT GREATEST(limit_num, 1);
    ELSE
        RETURN QUERY
        SELECT p.*
        FROM posts p
        WHERE p.embedding IS NOT NULL
        ORDER BY
            ((1 - (p.embedding <=> user_vec)) * 0.6) +
            (LOG(GREATEST((SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id), 1) + 1) * 0.3) +
            (1.0 / (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2) * 0.1) DESC,
            p.created_at DESC
        LIMIT GREATEST(limit_num, 1);
    END IF;
END;
$$ LANGUAGE plpgsql;
