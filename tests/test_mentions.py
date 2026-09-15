from backend.feed.routes import extract_mentions


def test_extract_mentions_finds_unique_usernames():
    matches = extract_mentions("Hello @alice and @bob, plus @alice again and @Charlie")
    assert matches == ["alice", "bob", "Charlie"]


def test_extract_mentions_is_case_sensitive():
    matches = extract_mentions("@Alice @alice @ALICE @Alice")
    assert matches == ["Alice", "alice", "ALICE"]
