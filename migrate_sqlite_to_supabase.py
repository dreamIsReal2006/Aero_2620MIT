"""Migrate the local SQLite data to Supabase PostgreSQL.

Usage (PowerShell):
    $env:DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
    $env:ADMIN_USERNAME = "your-admin-username"
    python migrate_sqlite_to_supabase.py

The source database is resolved relative to this file. ``aero.db`` is preferred;
``aero-fallback.db`` is used when it is not present.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_URL = (
    "postgresql://postgres.tamzlrygqskxscofwnho:[PASSWORD]@"
    "aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
)

# Parent tables must be copied before tables containing their foreign keys.
TABLE_ORDER = (
    "users",
    "posts",
    "comments",
    "follows",
    "likes",
    "comment_likes",
    "videos",
    "video_comments",
    "video_likes",
    "notes",
    "blocks",
    "mutes",
    "chat_groups",
    "chat_group_members",
    "messages",
    "notifications",
    "reports",
    "user_interactions",
    "moderation_logs",
    "appeal_tickets",
    "otp_codes",
)


def find_sqlite_database() -> Path:
    """Return the preferred local database path, or fail with a useful message."""
    for filename in ("aero.db", "aero-fallback.db"):
        database_path = BASE_DIR / filename
        if database_path.is_file():
            return database_path
    raise FileNotFoundError("找不到 aero.db 或 aero-fallback.db")


def get_source_tables(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    return {row[0] for row in rows}


def get_source_columns(connection: sqlite3.Connection, table_name: str) -> list[str]:
    return [row[1] for row in connection.execute(f'PRAGMA table_info("{table_name}")')]


def get_target_tables(connection) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """
        )
        return {row[0] for row in cursor.fetchall()}


def get_target_columns(connection, table_name: str) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table_name,),
        )
        return {row[0]: row[1] for row in cursor.fetchall()}


def convert_boolean_value(value):
    """Convert SQLite's common 0/1 boolean representation to Python bool."""
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"0", "false"}:
            return False
        if normalized in {"1", "true"}:
            return True
    return value


def migrate_table(
    sqlite_connection: sqlite3.Connection,
    postgres_connection,
    table_name: str,
    target_columns: dict[str, str],
) -> int:
    source_columns = get_source_columns(sqlite_connection, table_name)
    columns = [column for column in source_columns if column in target_columns]
    if not columns:
        print(f"跳过 {table_name}：没有可匹配的目标字段")
        return 0

    quoted_source_columns = ", ".join(f'"{column}"' for column in columns)
    rows = sqlite_connection.execute(
        f'SELECT {quoted_source_columns} FROM "{table_name}"'
    ).fetchall()
    if not rows:
        return 0

    boolean_indexes = {
        index
        for index, column in enumerate(columns)
        if target_columns[column] == "boolean"
    }
    rows = [
        tuple(
            convert_boolean_value(value) if index in boolean_indexes else value
            for index, value in enumerate(row)
        )
        for row in rows
    ]

    insert_statement = sql.SQL("INSERT INTO {} ({}) VALUES %s ON CONFLICT DO NOTHING").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(column) for column in columns),
    )
    with postgres_connection.cursor() as cursor:
        execute_values(cursor, insert_statement, rows, page_size=500)
    return len(rows)


def reset_sequence(postgres_connection, table_name: str) -> None:
    """Synchronize a serial/identity sequence with the largest migrated ID."""
    with postgres_connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_get_serial_sequence(%s, 'id')",
            (f"public.{table_name}",),
        )
        sequence_name = cursor.fetchone()[0]
        if sequence_name:
            cursor.execute(
                sql.SQL(
                    "SELECT setval(%s, COALESCE((SELECT MAX(id) FROM {}), 1), "
                    "(SELECT COUNT(*) > 0 FROM {}))"
                ).format(sql.Identifier(table_name), sql.Identifier(table_name)),
                (sequence_name,),
            )


def promote_admin(postgres_connection) -> int:
    usernames = {
        username.strip()
        for username in os.getenv("ADMIN_USERNAMES", os.getenv("ADMIN_USERNAME", "")).split(",")
        if username.strip()
    }
    email = os.getenv("ADMIN_EMAIL", "").strip()
    if not usernames and not email:
        print("未设置 ADMIN_USERNAME、ADMIN_USERNAMES 或 ADMIN_EMAIL，跳过管理员更新")
        return 0

    with postgres_connection.cursor() as cursor:
        if usernames and email:
            cursor.execute(
                "UPDATE users SET role = 'admin', is_admin = TRUE "
                "WHERE username = ANY(%s) OR email = %s",
                (list(usernames), email),
            )
        elif usernames:
            cursor.execute(
                "UPDATE users SET role = 'admin', is_admin = TRUE WHERE username = ANY(%s)",
                (list(usernames),),
            )
        else:
            cursor.execute(
                "UPDATE users SET role = 'admin', is_admin = TRUE WHERE email = %s",
                (email,),
            )
        return cursor.rowcount


def main() -> int:
    sqlite_connection = None
    postgres_connection = None
    try:
        sqlite_path = find_sqlite_database()
        database_url = os.getenv("DATABASE_URL") or DEFAULT_DATABASE_URL
        if "[PASSWORD]" in database_url:
            raise RuntimeError("请先设置 DATABASE_URL，或将脚本中的 [PASSWORD] 替换为真实密码")

        sqlite_connection = sqlite3.connect(sqlite_path)
        postgres_connection = psycopg2.connect(database_url)
        source_tables = get_source_tables(sqlite_connection)
        target_tables = get_target_tables(postgres_connection)
        migrated_counts: dict[str, int] = {}

        for table_name in TABLE_ORDER:
            if table_name not in source_tables:
                continue
            if table_name not in target_tables:
                print(f"跳过 {table_name}：Supabase 中不存在该表")
                continue
            migrated_counts[table_name] = migrate_table(
                sqlite_connection,
                postgres_connection,
                table_name,
                get_target_columns(postgres_connection, table_name),
            )

        for table_name in migrated_counts:
            reset_sequence(postgres_connection, table_name)

        admin_count = promote_admin(postgres_connection)
        postgres_connection.commit()

        print(f"成功迁移 {migrated_counts.get('users', 0)} 条用户数据")
        print(f"成功迁移 {migrated_counts.get('posts', 0)} 条帖子数据")
        print(f"成功迁移 {sum(migrated_counts.values())} 条数据，更新 {admin_count} 个管理员账号")
        return 0
    except Exception as error:
        if postgres_connection is not None:
            postgres_connection.rollback()
        print(f"迁移失败：{error}", file=sys.stderr)
        return 1
    finally:
        if sqlite_connection is not None:
            sqlite_connection.close()
        if postgres_connection is not None:
            postgres_connection.close()


if __name__ == "__main__":
    raise SystemExit(main())