#!/usr/bin/env python3
"""
V3 Migration: Spreadsheet + Firestore → Cloud SQL MySQL

Spreadsheet KnowledgeBase + Embeddings と
Firestore ChatHistory を Cloud SQL MySQL に移行します。

Usage:
    # Dry Run（データ確認のみ）
    python backend/scripts/migrate_to_mysql.py \\
        --spreadsheet-id 1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --dry-run

    # 本番実行
    python backend/scripts/migrate_to_mysql.py \\
        --spreadsheet-id 1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --database rag_system
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import hashlib

# 外部ライブラリ
try:
    import aiomysql
    import google.auth
    from google.cloud import firestore
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install aiomysql google-auth google-api-python-client google-cloud-firestore tqdm")
    sys.exit(1)

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('v3_migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class V3MySQLMigrator:
    """V3 Migration: Spreadsheet + Firestore → MySQL"""

    def __init__(
        self,
        spreadsheet_id: str,
        project_id: str,
        instance_name: str,
        database_name: str = 'rag_system',
        host: str = '127.0.0.1',  # Cloud SQL Proxy使用時
        port: int = 3306,
        user: str = 'root',
        password: str = '',
        dry_run: bool = False
    ):
        self.spreadsheet_id = spreadsheet_id
        self.project_id = project_id
        self.instance_name = instance_name
        self.database_name = database_name
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.dry_run = dry_run

        # Google Sheets API
        self.sheets_service = None

        # Firestore Client
        self.firestore_db = firestore.Client(project=project_id)

        # MySQL Connection Pool
        self.pool = None

        # 統計情報
        self.stats = {
            'knowledge_base': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'embeddings': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'clients': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'chat_sessions': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'chat_messages': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0}
        }

        # バックアップデータ（ロールバック用）
        self.backup_file = Path('v3_migration_backup.json')

    def init_sheets_service(self):
        """Google Sheets API初期化"""
        try:
            credentials, _ = google.auth.default(
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets.readonly',
                    'https://www.googleapis.com/auth/drive.readonly',
                ]
            )
            self.sheets_service = build('sheets', 'v4', credentials=credentials)
            logger.info("✅ Google Sheets API初期化完了")
        except Exception as e:
            logger.error(f"❌ Google Sheets API初期化失敗: {e}")
            raise

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

            # バージョン確認
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT VERSION()")
                    version = await cur.fetchone()
                    logger.info(f"MySQL Version: {version[0]}")

        except Exception as e:
            logger.error(f"❌ MySQL接続失敗: {e}")
            raise

    async def close_mysql_pool(self):
        """MySQL接続プール終了"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("MySQL接続プール終了")

    # ==================================================
    # Phase 1: Spreadsheet KnowledgeBase 移行
    # ==================================================

    def read_spreadsheet_knowledge_base(self) -> List[Dict[str, Any]]:
        """Spreadsheet KnowledgeBaseシートを読み込み"""
        try:
            logger.info("📖 Spreadsheet KnowledgeBase読み込み開始...")

            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='KnowledgeBase!A:Z'
            ).execute()

            values = result.get('values', [])
            if not values:
                logger.warning("KnowledgeBaseシートにデータがありません")
                return []

            # ヘッダー行
            headers = values[0]
            data = []

            for row in values[1:]:
                row_data = row + [''] * (len(headers) - len(row))
                record = dict(zip(headers, row_data))
                data.append(record)

            logger.info(f"✅ {len(data)}件のKnowledgeBaseデータを読み込みました")
            return data

        except Exception as e:
            logger.error(f"❌ KnowledgeBaseシート読み込みエラー: {e}")
            raise

    def read_spreadsheet_embeddings(self) -> Dict[str, List[float]]:
        """Spreadsheet Embeddingsシートを読み込み（2048次元）"""
        try:
            logger.info("📖 Spreadsheet Embeddings読み込み開始...")

            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='Embeddings!A:G'
            ).execute()

            values = result.get('values', [])
            if not values:
                logger.warning("Embeddingsシートにデータがありません")
                return {}

            embeddings_dict = {}

            for row in tqdm(values[1:], desc="Embeddings読み込み"):
                if len(row) < 7:
                    continue

                kb_id = row[0]
                try:
                    # embedding_part1, part2, part3を結合（3072次元）
                    part1 = json.loads(row[3]) if row[3] else []
                    part2 = json.loads(row[4]) if row[4] else []
                    part3 = json.loads(row[5]) if row[5] else []

                    full_embedding = part1 + part2 + part3

                    # 2048次元に切り詰め（Firestore互換性）
                    if len(full_embedding) >= 2048:
                        embedding_2048 = full_embedding[:2048]
                    else:
                        logger.warning(f"ベクトル次元数不足: {kb_id} (len={len(full_embedding)})")
                        continue

                    embeddings_dict[kb_id] = embedding_2048

                except json.JSONDecodeError as e:
                    logger.error(f"JSONパースエラー: {kb_id} - {e}")
                    continue

            logger.info(f"✅ {len(embeddings_dict)}件のEmbeddingsを読み込みました")
            return embeddings_dict

        except Exception as e:
            logger.error(f"❌ Embeddingsシート読み込みエラー: {e}")
            raise

    async def migrate_knowledge_base(
        self,
        knowledge_base_data: List[Dict[str, Any]],
        batch_size: int = 100
    ):
        """knowledge_base テーブルに移行"""
        logger.info("=== knowledge_base 移行開始 ===")

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for i in range(0, len(knowledge_base_data), batch_size):
                    batch = knowledge_base_data[i:i + batch_size]

                    for record in batch:
                        self.stats['knowledge_base']['total'] += 1

                        # データ変換
                        kb_id = record.get('id', '')
                        if not kb_id:
                            logger.warning("IDが空のレコードをスキップ")
                            self.stats['knowledge_base']['skipped'] += 1
                            continue

                        # metadata/structured_dataをJSON化
                        metadata_str = record.get('metadata', '{}')
                        try:
                            metadata = json.loads(metadata_str) if metadata_str else {}
                        except:
                            metadata = {}

                        structured_data_str = record.get('structured_data', '{}')
                        try:
                            structured_data = json.loads(structured_data_str) if structured_data_str else {}
                        except:
                            structured_data = {}

                        # date型変換
                        date_str = record.get('date', '')
                        if date_str:
                            try:
                                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                            except:
                                date_obj = None
                        else:
                            date_obj = None

                        if self.dry_run:
                            self.stats['knowledge_base']['success'] += 1
                            continue

                        # MySQL挿入
                        sql = """
                            INSERT INTO knowledge_base (
                                id, domain, source_type, source_table, source_id,
                                user_id, user_name, title, content,
                                structured_data, metadata, tags, date,
                                created_at, updated_at
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                            )
                            ON DUPLICATE KEY UPDATE
                                content = VALUES(content),
                                updated_at = NOW()
                        """

                        try:
                            await cur.execute(sql, (
                                kb_id,
                                record.get('domain', ''),
                                record.get('source_type', 'spreadsheet'),
                                record.get('source_table', ''),
                                record.get('source_id', ''),
                                record.get('user_id', ''),
                                record.get('user_name', ''),
                                record.get('title', ''),
                                record.get('content', ''),
                                json.dumps(structured_data, ensure_ascii=False),
                                json.dumps(metadata, ensure_ascii=False),
                                record.get('tags', ''),
                                date_obj
                            ))

                            self.stats['knowledge_base']['success'] += 1

                        except Exception as e:
                            logger.error(f"❌ knowledge_base挿入エラー: {kb_id} - {e}")
                            self.stats['knowledge_base']['failed'] += 1

                    # バッチコミット
                    if not self.dry_run:
                        await conn.commit()

                    logger.info(
                        f"Progress: {self.stats['knowledge_base']['success']}/"
                        f"{self.stats['knowledge_base']['total']} records"
                    )

        logger.info(f"✅ knowledge_base 移行完了: {self.stats['knowledge_base']['success']} records")

    async def migrate_embeddings(
        self,
        embeddings_dict: Dict[str, List[float]],
        batch_size: int = 100
    ):
        """embeddings テーブルに移行（VECTOR型使用）"""
        logger.info("=== embeddings 移行開始 ===")

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                kb_ids = list(embeddings_dict.keys())

                for i in range(0, len(kb_ids), batch_size):
                    batch_ids = kb_ids[i:i + batch_size]

                    for kb_id in batch_ids:
                        self.stats['embeddings']['total'] += 1

                        embedding = embeddings_dict[kb_id]

                        if self.dry_run:
                            self.stats['embeddings']['success'] += 1
                            continue

                        # VECTOR型挿入
                        # MySQL 9.0+ Vector Typeでは JSON配列をそのまま挿入
                        sql = """
                            INSERT INTO embeddings (
                                kb_id, embedding, embedding_model, created_at, updated_at
                            ) VALUES (
                                %s, %s, %s, NOW(), NOW()
                            )
                            ON DUPLICATE KEY UPDATE
                                embedding = VALUES(embedding),
                                updated_at = NOW()
                        """

                        try:
                            # VECTORカラムにJSON配列形式で挿入
                            embedding_json = json.dumps(embedding)

                            await cur.execute(sql, (
                                kb_id,
                                embedding_json,  # VECTOR型はJSON配列を受け付ける
                                'gemini-embedding-001'
                            ))

                            self.stats['embeddings']['success'] += 1

                        except Exception as e:
                            logger.error(f"❌ embeddings挿入エラー: {kb_id} - {e}")
                            self.stats['embeddings']['failed'] += 1

                    # バッチコミット
                    if not self.dry_run:
                        await conn.commit()

                    logger.info(
                        f"Progress: {self.stats['embeddings']['success']}/"
                        f"{self.stats['embeddings']['total']} vectors"
                    )

        logger.info(f"✅ embeddings 移行完了: {self.stats['embeddings']['success']} vectors")

    # ==================================================
    # Phase 2: Firestore ChatHistory 移行
    # ==================================================

    async def migrate_firestore_chat_history(self):
        """Firestore chat_sessions → MySQL"""
        logger.info("=== Firestore chat_sessions 移行開始 ===")

        # chat_sessionsコレクション取得
        sessions_ref = self.firestore_db.collection('chat_sessions')
        sessions = sessions_ref.stream()

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for session_doc in sessions:
                    self.stats['chat_sessions']['total'] += 1

                    session_data = session_doc.to_dict()
                    session_id = session_doc.id

                    # created_at, last_message_at変換
                    created_at = self._convert_firestore_timestamp(session_data.get('created_at'))
                    last_message_at = self._convert_firestore_timestamp(session_data.get('last_message_at'))

                    if self.dry_run:
                        self.stats['chat_sessions']['success'] += 1
                    else:
                        sql = """
                            INSERT INTO chat_sessions (
                                session_id, user_id, client_id, title, created_at, last_message_at
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s
                            )
                            ON DUPLICATE KEY UPDATE
                                last_message_at = VALUES(last_message_at)
                        """

                        try:
                            await cur.execute(sql, (
                                session_id,
                                session_data.get('user_id', ''),
                                session_data.get('client_id'),
                                session_data.get('title', ''),
                                created_at,
                                last_message_at
                            ))

                            self.stats['chat_sessions']['success'] += 1

                        except Exception as e:
                            logger.error(f"❌ chat_sessions挿入エラー: {session_id} - {e}")
                            self.stats['chat_sessions']['failed'] += 1

                    # メッセージ移行
                    await self._migrate_session_messages(session_id, cur, conn)

                # コミット
                if not self.dry_run:
                    await conn.commit()

        logger.info(f"✅ chat_sessions 移行完了: {self.stats['chat_sessions']['success']} sessions")

    async def _migrate_session_messages(self, session_id: str, cur, conn):
        """セッション内のメッセージを移行"""
        messages_ref = self.firestore_db.collection('chat_sessions').document(session_id).collection('messages')
        messages = messages_ref.order_by('created_at').stream()

        for msg_doc in messages:
            self.stats['chat_messages']['total'] += 1

            msg_data = msg_doc.to_dict()
            created_at = self._convert_firestore_timestamp(msg_data.get('created_at'))

            if self.dry_run:
                self.stats['chat_messages']['success'] += 1
                continue

            sql = """
                INSERT INTO chat_messages (
                    session_id, role, content, context_used, metadata, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s
                )
            """

            try:
                context_used = msg_data.get('context_used', {})
                metadata = msg_data.get('metadata', {})

                await cur.execute(sql, (
                    session_id,
                    msg_data.get('role', 'user'),
                    msg_data.get('content', ''),
                    json.dumps(context_used, ensure_ascii=False),
                    json.dumps(metadata, ensure_ascii=False),
                    created_at
                ))

                self.stats['chat_messages']['success'] += 1

            except Exception as e:
                logger.error(f"❌ chat_messages挿入エラー: {session_id} - {e}")
                self.stats['chat_messages']['failed'] += 1

    def _convert_firestore_timestamp(self, ts) -> str:
        """Firestore Timestamp → MySQL DATETIME"""
        if ts is None:
            return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        if hasattr(ts, 'timestamp'):
            dt = datetime.fromtimestamp(ts.timestamp())
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = datetime.now()

        return dt.strftime('%Y-%m-%d %H:%M:%S')

    # ==================================================
    # バックアップ機能（ロールバック用）
    # ==================================================

    def create_backup(self, knowledge_base_data: List[Dict], embeddings_dict: Dict):
        """移行前データをバックアップ"""
        if self.dry_run:
            logger.info("[DRY RUN] バックアップはスキップ")
            return

        logger.info("📦 バックアップ作成中...")

        backup_data = {
            'timestamp': datetime.now().isoformat(),
            'knowledge_base_count': len(knowledge_base_data),
            'embeddings_count': len(embeddings_dict),
            'knowledge_base_sample': knowledge_base_data[:5],  # サンプル5件
            'embeddings_sample': {k: v for k, v in list(embeddings_dict.items())[:5]}
        }

        with open(self.backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)

        logger.info(f"✅ バックアップ作成完了: {self.backup_file}")

    # ==================================================
    # メイン実行
    # ==================================================

    async def run(self, batch_size: int = 100):
        """移行実行"""
        logger.info("=" * 80)
        logger.info("V3 Migration: Spreadsheet + Firestore → Cloud SQL MySQL")
        logger.info("=" * 80)
        logger.info(f"Project: {self.project_id}")
        logger.info(f"Instance: {self.instance_name}")
        logger.info(f"Database: {self.database_name}")
        logger.info(f"Spreadsheet ID: {self.spreadsheet_id}")
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info("=" * 80)

        try:
            # 初期化
            self.init_sheets_service()
            await self.init_mysql_pool()

            # Phase 1: Spreadsheet KnowledgeBase + Embeddings
            logger.info("\n🔵 Phase 1: Spreadsheet KnowledgeBase + Embeddings 移行")
            knowledge_base_data = self.read_spreadsheet_knowledge_base()
            embeddings_dict = self.read_spreadsheet_embeddings()

            # バックアップ作成
            self.create_backup(knowledge_base_data, embeddings_dict)

            # 移行実行
            await self.migrate_knowledge_base(knowledge_base_data, batch_size)
            await self.migrate_embeddings(embeddings_dict, batch_size)

            # Phase 2: Firestore ChatHistory
            logger.info("\n🔵 Phase 2: Firestore ChatHistory 移行")
            await self.migrate_firestore_chat_history()

            # 統計出力
            logger.info("\n" + "=" * 80)
            logger.info("📊 Migration Summary")
            logger.info("=" * 80)
            for table, stats in self.stats.items():
                logger.info(f"{table}:")
                logger.info(f"  Total: {stats['total']}")
                logger.info(f"  Success: {stats['success']}")
                logger.info(f"  Failed: {stats['failed']}")
                logger.info(f"  Skipped: {stats['skipped']}")
            logger.info("=" * 80)

            if self.dry_run:
                logger.info("✅ DRY RUN完了（実際のデータ移行は行われていません）")
            else:
                logger.info("✅ 移行完了")

        except Exception as e:
            logger.error(f"❌ Migration failed: {e}", exc_info=True)
            raise

        finally:
            await self.close_mysql_pool()


async def main():
    parser = argparse.ArgumentParser(description='V3 Migration: Spreadsheet + Firestore → MySQL')
    parser.add_argument('--spreadsheet-id', required=True, help='Spreadsheet ID')
    parser.add_argument('--project', required=True, help='GCP Project ID')
    parser.add_argument('--instance', required=True, help='Cloud SQL Instance Name')
    parser.add_argument('--database', default='rag_system', help='Database Name')
    parser.add_argument('--host', default='127.0.0.1', help='MySQL Host (Cloud SQL Proxy)')
    parser.add_argument('--port', type=int, default=3306, help='MySQL Port')
    parser.add_argument('--user', default='root', help='MySQL User')
    parser.add_argument('--password', default='', help='MySQL Password')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch Size')
    parser.add_argument('--dry-run', action='store_true', help='Dry Run Mode')

    args = parser.parse_args()

    migrator = V3MySQLMigrator(
        spreadsheet_id=args.spreadsheet_id,
        project_id=args.project,
        instance_name=args.instance,
        database_name=args.database,
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        dry_run=args.dry_run
    )

    await migrator.run(batch_size=args.batch_size)


if __name__ == '__main__':
    asyncio.run(main())
