ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS poll_json TEXT;

CREATE TABLE IF NOT EXISTS post_votes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL CHECK (option_index >= 0 AND option_index < 4),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_vote UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_votes_post_id
    ON post_votes (post_id);
