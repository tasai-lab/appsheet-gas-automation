#!/usr/bin/env python3
"""
V3 Migration Rollback Script

移行をロールバックし、MySQLデータを削除します。
Spreadsheet/Firestoreのソースデータは影響を受けません。

Usage:
    # 確認モード（削除するデータを表示のみ）
    python backend/scripts/rollback_migration.py \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --database rag_system \\
        --dry-run

    # 実際にロールバック実行
    python backend/scripts/rollback_migration.py \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --database rag_system \\
        --confirm

    # 特定テーブルのみロールバック
    python backend/scripts/rollback_migration.py \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --database rag_system \\
        --tables knowledge_base embeddings \\
        --confirm
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

# 外部ライブラリ
try:
    import aiomysql
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install aiomysql")
    sys.exit(1)

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('v3_rollback.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class V3MigrationRollback:
    """V3 Migration Rollback"""

    def __init__(
        self,
        project_id: str,
        instance_name: str,
        database_name: str = 'rag_system',
        host: str = '127.0.0.1',
        port: int = 3306,
        user: str = 'root',
        password: str = '',
        tables: List[str] = None,
        dry_run: bool = False
    ):
        self.project_id = project_id
        self.instance_name = instance_name
        self.database_name = database_name
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.tables = tables or [
            'chat_messages',  # 外部キー制約のため先に削除
            'chat_sessions',
            'embeddings',     # 外部キー制約のため先に削除
            'knowledge_base',
            'clients',
            'vector_search_stats'
        ]
        self.dry_run = dry_run

        # MySQL Connection Pool
        self.pool = None

        # ロールバック統計
        self.stats = {}

        # バックアップファイル
        self.backup_file = Path('v3_migration_backup.json')
        self.rollback_backup_file = Path(f'v3_rollback_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')

    async def init_mysql_pool(self):
        """MySQL接続プール初期化"""
        try:
            logger.info(f"MySQL接続中: {self.host}:{self.port}/{self.database_name}")

            self.pool = await aiomysql.create_pool(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                db=self.database_name,
                minsize=1,
                maxsize=10,
                autocommit=False,
                charset='utf8mb4'
            )

            logger.info("✅ MySQL接続プール初期化完了")

        except Exception as e:
            logger.error(f"❌ MySQL接続失敗: {e}")
            raise

    async def close_mysql_pool(self):
        """MySQL接続プール終了"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()

    # ==================================================
    # ロールバック前のバックアップ
    # ==================================================

    async def backup_current_data(self):
        """ロールバック前に現在のMySQLデータをバックアップ"""
        logger.info("📦 ロールバック前バックアップ作成中...")

        backup_data = {
            'timestamp': datetime.now().isoformat(),
            'database': self.database_name,
            'tables': {}
        }

        async with self.pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                for table in self.tables:
                    # テーブルが存在するか確認
                    await cur.execute(f"SHOW TABLES LIKE '{table}'")
                    if not await cur.fetchone():
                        logger.warning(f"  ⚠️  テーブル '{table}' が存在しません（スキップ）")
                        continue

                    # レコード数取得
                    await cur.execute(f"SELECT COUNT(*) as count FROM {table}")
                    result = await cur.fetchone()
                    count = result['count']

                    backup_data['tables'][table] = {
                        'count': count
                    }

                    logger.info(f"  📊 {table}: {count} records")

                    # サンプルデータ取得（最初の5件）
                    if count > 0:
                        await cur.execute(f"SELECT * FROM {table} LIMIT 5")
                        samples = await cur.fetchall()
                        # datetime/dateをISO形式に変換
                        backup_data['tables'][table]['samples'] = [
                            {k: v.isoformat() if isinstance(v, (datetime, datetime.date)) else v
                             for k, v in sample.items()}
                            for sample in samples
                        ]

        # バックアップファイル保存
        with open(self.rollback_backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2, default=str)

        logger.info(f"✅ バックアップ作成完了: {self.rollback_backup_file}")

    # ==================================================
    # テーブルデータ削除
    # ==================================================

    async def truncate_table(self, table: str) -> Dict[str, Any]:
        """テーブルのデータを削除"""
        logger.info(f"\n🗑️  ロールバック: {table}")

        result = {
            'table': table,
            'records_before': 0,
            'records_after': 0,
            'success': False
        }

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                try:
                    # 削除前のレコード数
                    await cur.execute(f"SELECT COUNT(*) FROM {table}")
                    result['records_before'] = (await cur.fetchone())[0]

                    logger.info(f"  削除前: {result['records_before']} records")

                    if self.dry_run:
                        logger.info(f"  [DRY RUN] TRUNCATE TABLE {table} (実行されません)")
                        result['success'] = True
                        return result

                    # 外部キーチェック一時無効化
                    await cur.execute("SET FOREIGN_KEY_CHECKS = 0")

                    # テーブルデータ削除
                    await cur.execute(f"TRUNCATE TABLE {table}")

                    # 外部キーチェック再有効化
                    await cur.execute("SET FOREIGN_KEY_CHECKS = 1")

                    await conn.commit()

                    # 削除後のレコード数確認
                    await cur.execute(f"SELECT COUNT(*) FROM {table}")
                    result['records_after'] = (await cur.fetchone())[0]

                    result['success'] = True
                    logger.info(f"  ✅ 削除完了: {result['records_before']} → {result['records_after']} records")

                except Exception as e:
                    logger.error(f"  ❌ ロールバック失敗: {e}")
                    result['error'] = str(e)
                    await conn.rollback()

        return result

    # ==================================================
    # Vector Indexの再作成（オプション）
    # ==================================================

    async def recreate_vector_index(self):
        """Vector Indexを再作成（ロールバック後に必要な場合）"""
        logger.info("\n🔧 Vector Index再作成")

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                try:
                    # Vector Index削除
                    logger.info("  Vector Index削除中...")
                    await cur.execute("ALTER TABLE embeddings DROP INDEX IF EXISTS idx_embedding")

                    # Vector Index再作成
                    logger.info("  Vector Index再作成中...")
                    await cur.execute("""
                        ALTER TABLE embeddings ADD VECTOR INDEX idx_embedding (embedding)
                            DISTANCE METRIC COSINE
                            NLIST 100
                    """)

                    await conn.commit()
                    logger.info("  ✅ Vector Index再作成完了")

                except Exception as e:
                    logger.error(f"  ❌ Vector Index再作成失敗: {e}")
                    await conn.rollback()

    # ==================================================
    # メイン実行
    # ==================================================

    async def run(self, confirm: bool = False):
        """ロールバック実行"""
        logger.info("=" * 80)
        logger.info("V3 Migration Rollback")
        logger.info("=" * 80)
        logger.info(f"Project: {self.project_id}")
        logger.info(f"Instance: {self.instance_name}")
        logger.info(f"Database: {self.database_name}")
        logger.info(f"Tables: {', '.join(self.tables)}")
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info(f"Confirm: {confirm}")
        logger.info("=" * 80)

        if not self.dry_run and not confirm:
            logger.error("❌ ロールバックを実行するには --confirm フラグが必要です")
            logger.info("確認モードで実行する場合は --dry-run を使用してください")
            return False

        try:
            # MySQL接続
            await self.init_mysql_pool()

            # バックアップ作成
            if not self.dry_run:
                await self.backup_current_data()

            # 警告表示
            if not self.dry_run:
                logger.warning("\n⚠️  警告: この操作はMySQLのデータを削除します")
                logger.warning("⚠️  Spreadsheet/Firestoreのソースデータは影響を受けません")
                logger.warning("⚠️  バックアップは保存されています")
                logger.warning(f"⚠️  バックアップファイル: {self.rollback_backup_file}")

                # 最終確認
                await asyncio.sleep(3)  # 3秒待機
                logger.warning("\n▶️  3秒後にロールバックを開始します...")
                await asyncio.sleep(3)

            # テーブルごとにロールバック
            logger.info("\n🔄 ロールバック実行中...")
            for table in self.tables:
                result = await self.truncate_table(table)
                self.stats[table] = result

            # Vector Index再作成（embeddingsテーブルをロールバックした場合）
            if 'embeddings' in self.tables and not self.dry_run:
                await self.recreate_vector_index()

            # 統計出力
            logger.info("\n" + "=" * 80)
            logger.info("📊 Rollback Summary")
            logger.info("=" * 80)

            for table, result in self.stats.items():
                logger.info(f"{table}:")
                logger.info(f"  Before: {result['records_before']} records")
                logger.info(f"  After: {result['records_after']} records")
                logger.info(f"  Success: {'✅' if result['success'] else '❌'}")

            logger.info("=" * 80)

            if self.dry_run:
                logger.info("✅ DRY RUN完了（実際のロールバックは行われていません）")
            else:
                logger.info("✅ ロールバック完了")
                logger.info(f"📄 バックアップファイル: {self.rollback_backup_file}")

            return True

        except Exception as e:
            logger.error(f"❌ Rollback failed: {e}", exc_info=True)
            return False

        finally:
            await self.close_mysql_pool()


async def main():
    parser = argparse.ArgumentParser(description='V3 Migration Rollback')
    parser.add_argument('--project', required=True, help='GCP Project ID')
    parser.add_argument('--instance', required=True, help='Cloud SQL Instance Name')
    parser.add_argument('--database', default='rag_system', help='Database Name')
    parser.add_argument('--host', default='127.0.0.1', help='MySQL Host')
    parser.add_argument('--port', type=int, default=3306, help='MySQL Port')
    parser.add_argument('--user', default='root', help='MySQL User')
    parser.add_argument('--password', default='', help='MySQL Password')
    parser.add_argument('--tables', nargs='+', help='Tables to rollback (default: all tables)')
    parser.add_argument('--dry-run', action='store_true', help='Dry Run Mode (show what would be deleted)')
    parser.add_argument('--confirm', action='store_true', help='Confirm rollback execution')

    args = parser.parse_args()

    rollback = V3MigrationRollback(
        project_id=args.project,
        instance_name=args.instance,
        database_name=args.database,
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        tables=args.tables,
        dry_run=args.dry_run
    )

    success = await rollback.run(confirm=args.confirm)

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    asyncio.run(main())
