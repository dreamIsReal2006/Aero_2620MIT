CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS hashtags (
    id SERIAL PRIMARY KEY,
    tag VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_post
    ON post_hashtags (hashtag_id, post_id);

CREATE TABLE IF NOT EXISTS user_hashtag_interests (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 1),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, hashtag_id)
);

INSERT INTO hashtags (tag)
SELECT DISTINCT LOWER(matches[1])
FROM posts p
CROSS JOIN LATERAL regexp_matches(p.content, '#([[:alnum:]_][[:alnum:]_.-]{0,99})', 'g') AS matches
ON CONFLICT (tag) DO NOTHING;

INSERT INTO post_hashtags (post_id, hashtag_id)
SELECT DISTINCT p.id, h.id
FROM posts p
CROSS JOIN LATERAL regexp_matches(p.content, '#([[:alnum:]_][[:alnum:]_.-]{0,99})', 'g') AS matches
JOIN hashtags h ON h.tag = LOWER(matches[1])
ON CONFLICT (post_id, hashtag_id) DO NOTHING;

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

    RETURN QUERY
    SELECT p.*
    FROM posts p
    LEFT JOIN LATERAL (
        SELECT AVG(uhi.weight) AS match_score
        FROM post_hashtags ph
        JOIN user_hashtag_interests uhi ON uhi.hashtag_id = ph.hashtag_id
        WHERE ph.post_id = p.id AND uhi.user_id = user_id_param
    ) tag_score ON TRUE
    ORDER BY
        (0.5 * CASE
            WHEN p.embedding IS NULL OR user_vec IS NULL THEN 0.0
            ELSE GREATEST(1.0 - (p.embedding <=> user_vec), 0.0)
        END) +
        (0.3 * COALESCE(tag_score.match_score, 0.0)) +
        (0.2 * EXP(-GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)), 0.0) / 172800.0)) DESC,
        p.created_at DESC
    LIMIT GREATEST(limit_num, 1);
END;
$$ LANGUAGE plpgsql;
