#!/usr/bin/env python3
"""
Firestore → Cloud SQL MySQL 移行スクリプト

Firestoreの knowledge_base, clients, vectors コレクションを
Cloud SQL MySQLに移行します。

Usage:
    python migrate_firestore_to_mysql.py --project fractal-ecosystem --instance rag-mysql --dry-run
    python migrate_firestore_to_mysql.py --project fractal-ecosystem --instance rag-mysql
"""

import argparse
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional
import json

import aiomysql
import asyncio
from google.cloud import firestore
from google.oauth2 import service_account
from google.auth import default

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('firestore_to_mysql_migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class FirestoreToMySQLMigrator:
    """Firestore → MySQL 移行クラス"""

    def __init__(
        self,
        project_id: str,
        instance_name: str,
        database_name: str = 'rag_system',
        user: str = 'root',
        password: str = 'RagSystem2025!',
        dry_run: bool = False
    ):
        self.project_id = project_id
        self.instance_name = instance_name
        self.database_name = database_name
        self.user = user
        self.password = password
        self.dry_run = dry_run

        # Firestore client
        self.db = firestore.Client(project=project_id)

        # MySQL connection pool
        self.pool = None

        # Statistics
        self.stats = {
            'knowledge_base': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'clients': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0},
            'vectors': {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0}
        }

    async def init_mysql_pool(self):
        """MySQL接続プール初期化"""
        try:
            # Cloud SQL Unix socket connection
            unix_socket = f'/cloudsql/{self.project_id}:{self.instance_name}'

            logger.info(f"Connecting to MySQL via socket: {unix_socket}")

            self.pool = await aiomysql.create_pool(
                unix_socket=unix_socket,
                user=self.user,
                password=self.password,
                db=self.database_name,
                minsize=1,
                maxsize=10,
                autocommit=False,
                charset='utf8mb4'
            )

            logger.info("✅ MySQL connection pool initialized")
        except Exception as e:
            logger.error(f"❌ Failed to connect to MySQL: {e}")
            raise

    async def close_mysql_pool(self):
        """MySQL接続プール終了"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("MySQL connection pool closed")

    async def migrate_knowledge_base(self, batch_size: int = 100):
        """knowledge_base コレクション移行"""
        logger.info("=== knowledge_base 移行開始 ===")

        # Firestore query
        docs = self.db.collection('knowledge_base').stream()

        batch = []
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for doc in docs:
                    self.stats['knowledge_base']['total'] += 1
                    data = doc.to_dict()

                    # データ変換
                    record = {
                        'id': doc.id,
                        'domain': data.get('domain', 'unknown'),
                        'source_id': data.get('source_id'),
                        'source_type': data.get('source_type', 'firestore'),
                        'title': data.get('title'),
                        'content': data.get('content', ''),
                        'user_id': data.get('user_id'),
                        'user_name': data.get('user_name'),
                        'created_at': self._convert_timestamp(data.get('created_at')),
                        'updated_at': self._convert_timestamp(data.get('updated_at')),
                        'metadata': json.dumps(data.get('metadata', {}), ensure_ascii=False),
                        'embedding_id': data.get('embedding_id')
                    }

                    batch.append(record)

                    # バッチ挿入
                    if len(batch) >= batch_size:
                        await self._insert_knowledge_base_batch(cur, batch, conn)
                        batch = []
                        logger.info(f"Progress: {self.stats['knowledge_base']['success']}/{self.stats['knowledge_base']['total']} records")

                # 残りを挿入
                if batch:
                    await self._insert_knowledge_base_batch(cur, batch, conn)

        logger.info(f"✅ knowledge_base 移行完了: {self.stats['knowledge_base']['success']} records")

    async def _insert_knowledge_base_batch(self, cursor, batch: List[Dict], conn):
        """knowledge_base バッチ挿入"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would insert {len(batch)} knowledge_base records")
            self.stats['knowledge_base']['success'] += len(batch)
            return

        sql = """
            INSERT INTO knowledge_base (
                id, domain, source_id, source_type, title, content,
                user_id, user_name, created_at, updated_at, metadata, embedding_id
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                content = VALUES(content),
                updated_at = VALUES(updated_at),
                metadata = VALUES(metadata),
                embedding_id = VALUES(embedding_id)
        """

        try:
            values = [
                (
                    r['id'], r['domain'], r['source_id'], r['source_type'],
                    r['title'], r['content'], r['user_id'], r['user_name'],
                    r['created_at'], r['updated_at'], r['metadata'], r['embedding_id']
                )
                for r in batch
            ]

            await cursor.executemany(sql, values)
            await conn.commit()

            self.stats['knowledge_base']['success'] += len(batch)
        except Exception as e:
            logger.error(f"❌ Batch insert failed: {e}")
            await conn.rollback()
            self.stats['knowledge_base']['failed'] += len(batch)

    async def migrate_clients(self, batch_size: int = 100):
        """clients コレクション移行"""
        logger.info("=== clients 移行開始 ===")

        docs = self.db.collection('clients').stream()

        batch = []
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for doc in docs:
                    self.stats['clients']['total'] += 1
                    data = doc.to_dict()

                    record = {
                        'client_id': doc.id,
                        'client_name': data.get('client_name', ''),
                        'created_at': self._convert_timestamp(data.get('created_at')),
                        'updated_at': self._convert_timestamp(data.get('updated_at')),
                        'metadata': json.dumps(data.get('metadata', {}), ensure_ascii=False)
                    }

                    batch.append(record)

                    if len(batch) >= batch_size:
                        await self._insert_clients_batch(cur, batch, conn)
                        batch = []
                        logger.info(f"Progress: {self.stats['clients']['success']}/{self.stats['clients']['total']} clients")

                if batch:
                    await self._insert_clients_batch(cur, batch, conn)

        logger.info(f"✅ clients 移行完了: {self.stats['clients']['success']} clients")

    async def _insert_clients_batch(self, cursor, batch: List[Dict], conn):
        """clients バッチ挿入"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would insert {len(batch)} clients")
            self.stats['clients']['success'] += len(batch)
            return

        sql = """
            INSERT INTO clients (
                client_id, client_name, created_at, updated_at, metadata
            ) VALUES (
                %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                client_name = VALUES(client_name),
                updated_at = VALUES(updated_at),
                metadata = VALUES(metadata)
        """

        try:
            values = [
                (r['client_id'], r['client_name'], r['created_at'], r['updated_at'], r['metadata'])
                for r in batch
            ]

            await cursor.executemany(sql, values)
            await conn.commit()

            self.stats['clients']['success'] += len(batch)
        except Exception as e:
            logger.error(f"❌ Clients batch insert failed: {e}")
            await conn.rollback()
            self.stats['clients']['failed'] += len(batch)

    async def extract_vector_embeddings_metadata(self):
        """
        vectors コレクションからembedding_id情報を抽出し、
        knowledge_baseテーブルのembedding_id列に反映

        Note: 実際のベクトルデータはVertex AI Vector Searchに格納
        """
        logger.info("=== vectors メタデータ抽出開始 ===")

        docs = self.db.collection('vectors').stream()

        updates = []
        for doc in docs:
            self.stats['vectors']['total'] += 1
            data = doc.to_dict()

            # vectorsドキュメントIDは knowledge_base の document_id と対応
            knowledge_base_id = doc.id
            embedding_id = data.get('embedding_id')  # Vertex AI Vector Search ID

            if embedding_id:
                updates.append((embedding_id, knowledge_base_id))

        logger.info(f"Found {len(updates)} vector embeddings to link")

        # knowledge_base テーブルの embedding_id を更新
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                if self.dry_run:
                    logger.info(f"[DRY RUN] Would update {len(updates)} embedding_id references")
                    self.stats['vectors']['success'] = len(updates)
                    return

                sql = """
                    UPDATE knowledge_base
                    SET embedding_id = %s
                    WHERE id = %s
                """

                try:
                    await cur.executemany(sql, updates)
                    await conn.commit()
                    self.stats['vectors']['success'] = len(updates)
                    logger.info(f"✅ {len(updates)} embedding_id references updated")
                except Exception as e:
                    logger.error(f"❌ Failed to update embedding_id: {e}")
                    await conn.rollback()
                    self.stats['vectors']['failed'] = len(updates)

    def _convert_timestamp(self, ts) -> str:
        """Firestore Timestamp → MySQL DATETIME"""
        if ts is None:
            return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        if hasattr(ts, 'timestamp'):
            # Firestore Timestamp
            dt = datetime.fromtimestamp(ts.timestamp())
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = datetime.now()

        return dt.strftime('%Y-%m-%d %H:%M:%S')

    async def run(self, batch_size: int = 100):
        """移行実行"""
        logger.info("=" * 60)
        logger.info("Firestore → Cloud SQL MySQL Migration")
        logger.info("=" * 60)
        logger.info(f"Project: {self.project_id}")
        logger.info(f"Instance: {self.instance_name}")
        logger.info(f"Database: {self.database_name}")
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info("=" * 60)

        try:
            # MySQL接続
            await self.init_mysql_pool()

            # 移行実行
            await self.migrate_knowledge_base(batch_size)
            await self.migrate_clients(batch_size)
            await self.extract_vector_embeddings_metadata()

            # 統計出力
            logger.info("=" * 60)
            logger.info("Migration Summary")
            logger.info("=" * 60)
            for collection, stats in self.stats.items():
                logger.info(f"{collection}:")
                logger.info(f"  Total: {stats['total']}")
                logger.info(f"  Success: {stats['success']}")
                logger.info(f"  Failed: {stats['failed']}")
                logger.info(f"  Skipped: {stats['skipped']}")
            logger.info("=" * 60)

            if self.dry_run:
                logger.info("✅ DRY RUN完了（実際のデータ移行は行われていません）")
            else:
                logger.info("✅ 移行完了")

        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            raise
        finally:
            await self.close_mysql_pool()


async def main():
    parser = argparse.ArgumentParser(description='Firestore → Cloud SQL MySQL 移行')
    parser.add_argument('--project', required=True, help='GCP Project ID')
    parser.add_argument('--instance', required=True, help='Cloud SQL Instance Name')
    parser.add_argument('--database', default='rag_system', help='Database Name')
    parser.add_argument('--user', default='root', help='MySQL User')
    parser.add_argument('--password', default='RagSystem2025!', help='MySQL Password')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch Size')
    parser.add_argument('--dry-run', action='store_true', help='Dry Run Mode')

    args = parser.parse_args()

    migrator = FirestoreToMySQLMigrator(
        project_id=args.project,
        instance_name=args.instance,
        database_name=args.database,
        user=args.user,
        password=args.password,
        dry_run=args.dry_run
    )

    await migrator.run(batch_size=args.batch_size)


if __name__ == '__main__':
    asyncio.run(main())
