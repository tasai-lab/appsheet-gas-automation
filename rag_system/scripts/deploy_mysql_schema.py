#!/usr/bin/env python3
"""
MySQL スキーマデプロイスクリプト

Usage:
    python deploy_mysql_schema.py
"""

import pymysql
import sys
from pathlib import Path

# 接続情報
HOST = '34.55.32.28'  # Cloud SQL Public IP
USER = 'root'
PASSWORD = 'RagSystem2025!'
DATABASE = 'rag_system'

def deploy_schema():
    """スキーマをデプロイ"""
    # schema.sqlを読み込み
    schema_path = Path(__file__).parent.parent / 'backend' / 'sql' / 'schema.sql'

    if not schema_path.exists():
        print(f"❌ schema.sql not found: {schema_path}")
        sys.exit(1)

    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    print(f"✅ schema.sql loaded from {schema_path}")

    # MySQLに接続
    try:
        connection = pymysql.connect(
            host=HOST,
            user=USER,
            password=PASSWORD,
            database=DATABASE,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )

        print(f"✅ Connected to MySQL: {HOST}/{DATABASE}")

        with connection.cursor() as cursor:
            # スキーマを実行（複数のステートメントを個別に実行）
            statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]

            for i, stmt in enumerate(statements, 1):
                if stmt.lower().startswith(('create table', 'create index', 'alter table')):
                    print(f"Executing statement {i}/{len(statements)}: {stmt[:60]}...")
                    try:
                        cursor.execute(stmt)
                        print(f"  ✅ Success")
                    except pymysql.err.OperationalError as e:
                        if 'already exists' in str(e).lower():
                            print(f"  ⚠️  Already exists (skipping)")
                        else:
                            raise

        connection.commit()
        print("\n✅ スキーマデプロイ完了")

        # テーブル確認
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"\n📊 作成されたテーブル ({len(tables)}):")
            for table in tables:
                table_name = list(table.values())[0]
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                print(f"  - {table_name} ({len(columns)} columns)")

        connection.close()

    except pymysql.Error as e:
        print(f"❌ MySQL Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    deploy_schema()
