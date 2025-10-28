#!/usr/bin/env python3
"""
Firestore → MySQL データ移行スクリプト

Firestoreのknowledge_baseコレクションとembeddingデータをCloud SQL (MySQL)に移行します。
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from google.cloud import firestore
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import close_db, db_manager, init_db

# ロガー設定
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 設定
settings = get_settings()


class FirestoreToMySQLMigrator:
    """Firestore → MySQL データ移行クラス"""

    def __init__(self, dry_run: bool = False, batch_size: int = 100):
        """
        初期化

        Args:
            dry_run: ドライランモード（実際のデータ書き込みなし）
            batch_size: バッチサイズ（一度に処理するドキュメント数）
        """
        self.dry_run = dry_run
        self.batch_size = batch_size

        # Firestore クライアント
        self.firestore_db = firestore.Client(project=settings.gcp_project_id)
        self.collection_name = "knowledge_base"

        # 統計情報
        self.stats = {
            "total_documents": 0,
            "migrated_documents": 0,
            "migrated_embeddings": 0,
            "failed_documents": 0,
            "errors": [],
        }

        logger.info(f"🔧 Migrator initialized (dry_run={dry_run}, batch_size={batch_size})")

    def fetch_all_documents(self) -> List[Dict[str, Any]]:
        """
        Firestoreから全ドキュメントを取得

        Returns:
            ドキュメントリスト
        """
        logger.info(f"📥 Fetching documents from Firestore collection '{self.collection_name}'...")

        collection_ref = self.firestore_db.collection(self.collection_name)
        docs = collection_ref.stream()

        documents = []
        for doc in docs:
            data = doc.to_dict()
            data["_firestore_id"] = doc.id  # Firestore IDを保持
            documents.append(data)

        self.stats["total_documents"] = len(documents)
        logger.info(f"✅ Fetched {len(documents)} documents from Firestore")

        return documents

    def transform_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        FirestoreドキュメントをMySQL形式に変換

        Args:
            doc: Firestoreドキュメント

        Returns:
            MySQL挿入用データ
        """
        # IDの取得（Firestore IDまたはidフィールド）
        doc_id = doc.get("id") or doc.get("_firestore_id")

        # 日付の変換
        date_value = doc.get("date")
        if isinstance(date_value, datetime):
            date_str = date_value.strftime("%Y-%m-%d")
        elif isinstance(date_value, str):
            date_str = date_value
        else:
            date_str = None

        # JSON フィールドの変換
        structured_data = doc.get("structured_data")
        if structured_data and not isinstance(structured_data, str):
            structured_data = json.dumps(structured_data, ensure_ascii=False)

        metadata = doc.get("metadata")
        if metadata and not isinstance(metadata, str):
            metadata = json.dumps(metadata, ensure_ascii=False)

        # knowledge_base テーブル用データ
        kb_data = {
            "id": doc_id,
            "domain": doc.get("domain", "unknown"),
            "source_type": doc.get("source_type", "firestore"),
            "source_table": doc.get("source_table"),
            "source_id": doc.get("source_id"),
            "user_id": doc.get("user_id"),
            "user_name": doc.get("user_name"),
            "title": doc.get("title", ""),
            "content": doc.get("content", ""),
            "structured_data": structured_data,
            "metadata": metadata,
            "tags": doc.get("tags"),
            "date": date_str,
        }

        # embedding テーブル用データ
        embedding_data = None
        if "embedding" in doc and doc["embedding"]:
            # Firestoreのembeddingはリスト形式
            embedding_vector = doc["embedding"]

            # Vector型の文字列表現に変換（MySQL 9.0+ VECTOR型）
            # 形式: "[0.1, 0.2, 0.3, ...]"
            if isinstance(embedding_vector, list):
                embedding_str = json.dumps(embedding_vector)
            else:
                embedding_str = str(embedding_vector)

            embedding_data = {
                "kb_id": doc_id,
                "embedding": embedding_str,
                "embedding_model": doc.get("embedding_model", "gemini-embedding-001"),
            }

        return {"knowledge_base": kb_data, "embedding": embedding_data}

    async def insert_batch(
        self, knowledge_base_batch: List[Dict[str, Any]], embedding_batch: List[Dict[str, Any]]
    ) -> None:
        """
        バッチ挿入

        Args:
            knowledge_base_batch: knowledge_base挿入データ
            embedding_batch: embedding挿入データ
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would insert {len(knowledge_base_batch)} KB + {len(embedding_batch)} embeddings")
            return

        try:
            async with db_manager.get_session() as session:
                # knowledge_base挿入
                if knowledge_base_batch:
                    kb_insert_sql = text("""
                        INSERT INTO knowledge_base (
                            id, domain, source_type, source_table, source_id,
                            user_id, user_name, title, content,
                            structured_data, metadata, tags, date
                        ) VALUES (
                            :id, :domain, :source_type, :source_table, :source_id,
                            :user_id, :user_name, :title, :content,
                            :structured_data, :metadata, :tags, :date
                        )
                        ON DUPLICATE KEY UPDATE
                            title = VALUES(title),
                            content = VALUES(content),
                            updated_at = CURRENT_TIMESTAMP
                    """)

                    await session.execute(kb_insert_sql, knowledge_base_batch)
                    self.stats["migrated_documents"] += len(knowledge_base_batch)

                # embedding挿入
                if embedding_batch:
                    embedding_insert_sql = text("""
                        INSERT INTO embeddings (
                            kb_id, embedding, embedding_model
                        ) VALUES (
                            :kb_id, :embedding, :embedding_model
                        )
                        ON DUPLICATE KEY UPDATE
                            embedding = VALUES(embedding),
                            updated_at = CURRENT_TIMESTAMP
                    """)

                    await session.execute(embedding_insert_sql, embedding_batch)
                    self.stats["migrated_embeddings"] += len(embedding_batch)

                # コミット
                await session.commit()

                logger.info(f"✅ Inserted batch: {len(knowledge_base_batch)} KB + {len(embedding_batch)} embeddings")

        except SQLAlchemyError as e:
            logger.error(f"❌ Batch insert failed: {e}", exc_info=True)
            self.stats["failed_documents"] += len(knowledge_base_batch)
            self.stats["errors"].append(str(e))
            raise

    async def migrate(self) -> Dict[str, Any]:
        """
        移行実行

        Returns:
            統計情報
        """
        start_time = datetime.now()
        logger.info("=" * 80)
        logger.info("🚀 Starting Firestore → MySQL migration")
        logger.info("=" * 80)
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info(f"Batch Size: {self.batch_size}")
        logger.info("=" * 80)

        try:
            # Firestore からデータ取得
            documents = self.fetch_all_documents()

            if not documents:
                logger.warning("⚠️  No documents found in Firestore")
                return self.stats

            # バッチ処理
            kb_batch = []
            embedding_batch = []

            for i, doc in enumerate(documents, 1):
                try:
                    # 変換
                    transformed = self.transform_document(doc)

                    # バッチに追加
                    kb_batch.append(transformed["knowledge_base"])

                    if transformed["embedding"]:
                        embedding_batch.append(transformed["embedding"])

                    # バッチサイズに達したら挿入
                    if len(kb_batch) >= self.batch_size:
                        await self.insert_batch(kb_batch, embedding_batch)
                        kb_batch = []
                        embedding_batch = []

                    # 進捗表示
                    if i % 100 == 0:
                        progress = (i / len(documents)) * 100
                        logger.info(f"📊 Progress: {i}/{len(documents)} ({progress:.1f}%)")

                except Exception as e:
                    logger.error(f"❌ Failed to process document {doc.get('_firestore_id')}: {e}")
                    self.stats["failed_documents"] += 1
                    self.stats["errors"].append(f"Doc {doc.get('_firestore_id')}: {str(e)}")

            # 残りのバッチを挿入
            if kb_batch:
                await self.insert_batch(kb_batch, embedding_batch)

            # 統計情報
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            self.stats["duration_seconds"] = duration
            self.stats["success_rate"] = (
                (self.stats["migrated_documents"] / self.stats["total_documents"]) * 100
                if self.stats["total_documents"] > 0
                else 0
            )

            logger.info("=" * 80)
            logger.info("✅ Migration completed!")
            logger.info("=" * 80)
            logger.info(f"Total Documents: {self.stats['total_documents']}")
            logger.info(f"Migrated Documents: {self.stats['migrated_documents']}")
            logger.info(f"Migrated Embeddings: {self.stats['migrated_embeddings']}")
            logger.info(f"Failed Documents: {self.stats['failed_documents']}")
            logger.info(f"Success Rate: {self.stats['success_rate']:.2f}%")
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info("=" * 80)

            return self.stats

        except Exception as e:
            logger.error(f"❌ Migration failed: {e}", exc_info=True)
            self.stats["errors"].append(f"Fatal error: {str(e)}")
            raise


async def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description="Firestore → MySQL データ移行")
    parser.add_argument("--dry-run", action="store_true", help="ドライランモード（実際の書き込みなし）")
    parser.add_argument("--batch-size", type=int, default=100, help="バッチサイズ（デフォルト: 100）")
    parser.add_argument("--output", type=str, help="統計情報の出力先JSONファイル")

    args = parser.parse_args()

    try:
        # データベース初期化
        logger.info("🔄 Initializing database connection...")
        await init_db()
        logger.info("✅ Database connection initialized")

        # 移行実行
        migrator = FirestoreToMySQLMigrator(dry_run=args.dry_run, batch_size=args.batch_size)
        stats = await migrator.migrate()

        # 統計情報をファイルに出力
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(json.dumps(stats, indent=2, ensure_ascii=False))
            logger.info(f"📄 Stats written to {output_path}")

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # データベース接続クローズ
        await close_db()
        logger.info("🔒 Database connection closed")


if __name__ == "__main__":
    asyncio.run(main())
