#!/usr/bin/env python3
"""
データ移行検証スクリプト

Firestore → MySQL データ移行後の整合性をチェックします。
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from google.cloud import firestore
from sqlalchemy import text

from app.config import get_settings
from app.database import close_db, db_manager, init_db

# ロガー設定
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 設定
settings = get_settings()


class MigrationValidator:
    """データ移行検証クラス"""

    def __init__(self):
        """初期化"""
        # Firestore クライアント
        self.firestore_db = firestore.Client(project=settings.gcp_project_id)
        self.collection_name = "knowledge_base"

        # 検証結果
        self.validation_results = {
            "firestore_count": 0,
            "mysql_kb_count": 0,
            "mysql_embedding_count": 0,
            "missing_in_mysql": [],
            "embedding_dimension_errors": [],
            "sample_matches": [],
            "errors": [],
        }

        logger.info("🔧 Validator initialized")

    def fetch_firestore_count(self) -> int:
        """
        Firestoreのドキュメント数を取得

        Returns:
            ドキュメント数
        """
        logger.info(f"📥 Counting Firestore documents in '{self.collection_name}'...")

        collection_ref = self.firestore_db.collection(self.collection_name)
        docs = collection_ref.stream()

        count = sum(1 for _ in docs)

        logger.info(f"✅ Firestore documents: {count}")
        return count

    def fetch_firestore_sample_ids(self, limit: int = 10) -> List[str]:
        """
        Firestoreのサンプルドキュメント IDを取得

        Args:
            limit: 取得件数

        Returns:
            ドキュメント IDリスト
        """
        logger.info(f"📥 Fetching {limit} sample document IDs from Firestore...")

        collection_ref = self.firestore_db.collection(self.collection_name)
        docs = collection_ref.limit(limit).stream()

        ids = []
        for doc in docs:
            data = doc.to_dict()
            doc_id = data.get("id") or doc.id
            ids.append(doc_id)

        logger.info(f"✅ Fetched {len(ids)} sample IDs")
        return ids

    async def fetch_mysql_counts(self) -> Dict[str, int]:
        """
        MySQLのレコード数を取得

        Returns:
            テーブルごとのレコード数
        """
        logger.info("📥 Counting MySQL records...")

        counts = {}

        try:
            async with db_manager.get_session() as session:
                # knowledge_base テーブル
                kb_result = await session.execute(text("SELECT COUNT(*) FROM knowledge_base"))
                counts["knowledge_base"] = kb_result.scalar()

                # embeddings テーブル
                emb_result = await session.execute(text("SELECT COUNT(*) FROM embeddings"))
                counts["embeddings"] = emb_result.scalar()

                logger.info(f"✅ MySQL counts: KB={counts['knowledge_base']}, Embeddings={counts['embeddings']}")

                return counts

        except Exception as e:
            logger.error(f"❌ Failed to fetch MySQL counts: {e}", exc_info=True)
            self.validation_results["errors"].append(f"MySQL count error: {str(e)}")
            raise

    async def validate_sample_documents(self, sample_ids: List[str]) -> None:
        """
        サンプルドキュメントの存在チェック

        Args:
            sample_ids: 検証対象のドキュメント ID
        """
        logger.info(f"🔍 Validating {len(sample_ids)} sample documents...")

        try:
            async with db_manager.get_session() as session:
                for doc_id in sample_ids:
                    # knowledge_base 存在チェック
                    kb_result = await session.execute(
                        text("SELECT id, title FROM knowledge_base WHERE id = :id"), {"id": doc_id}
                    )
                    kb_row = kb_result.fetchone()

                    # embedding 存在チェック
                    emb_result = await session.execute(
                        text("SELECT kb_id FROM embeddings WHERE kb_id = :kb_id"), {"kb_id": doc_id}
                    )
                    emb_row = emb_result.fetchone()

                    if kb_row and emb_row:
                        self.validation_results["sample_matches"].append(
                            {"id": doc_id, "title": kb_row[1], "has_embedding": True}
                        )
                        logger.info(f"  ✅ {doc_id}: Found in both KB and Embeddings")
                    elif kb_row:
                        logger.warning(f"  ⚠️  {doc_id}: Found in KB but missing Embedding")
                    else:
                        logger.error(f"  ❌ {doc_id}: Missing in MySQL")
                        self.validation_results["missing_in_mysql"].append(doc_id)

        except Exception as e:
            logger.error(f"❌ Sample validation failed: {e}", exc_info=True)
            self.validation_results["errors"].append(f"Sample validation error: {str(e)}")
            raise

    async def validate_embedding_dimensions(self, sample_size: int = 5) -> None:
        """
        Embeddingの次元数チェック

        Args:
            sample_size: チェックするサンプル数
        """
        logger.info(f"🔍 Validating embedding dimensions (sample size: {sample_size})...")

        try:
            async with db_manager.get_session() as session:
                # サンプル取得
                result = await session.execute(
                    text("SELECT kb_id, embedding FROM embeddings LIMIT :limit"), {"limit": sample_size}
                )

                rows = result.fetchall()

                for kb_id, embedding_str in rows:
                    try:
                        # JSON パース
                        embedding_list = json.loads(embedding_str)

                        # 次元数チェック（2048次元）
                        if len(embedding_list) != 2048:
                            error_msg = f"{kb_id}: Invalid dimension {len(embedding_list)} (expected 2048)"
                            logger.error(f"  ❌ {error_msg}")
                            self.validation_results["embedding_dimension_errors"].append(error_msg)
                        else:
                            logger.info(f"  ✅ {kb_id}: Dimension OK (2048)")

                    except Exception as e:
                        error_msg = f"{kb_id}: Failed to parse embedding - {str(e)}"
                        logger.error(f"  ❌ {error_msg}")
                        self.validation_results["embedding_dimension_errors"].append(error_msg)

        except Exception as e:
            logger.error(f"❌ Embedding validation failed: {e}", exc_info=True)
            self.validation_results["errors"].append(f"Embedding validation error: {str(e)}")
            raise

    async def validate(self) -> Dict[str, Any]:
        """
        検証実行

        Returns:
            検証結果
        """
        logger.info("=" * 80)
        logger.info("🚀 Starting migration validation")
        logger.info("=" * 80)

        try:
            # 1. レコード数確認
            logger.info("\n[1/4] Validating record counts...")
            self.validation_results["firestore_count"] = self.fetch_firestore_count()
            mysql_counts = await self.fetch_mysql_counts()
            self.validation_results["mysql_kb_count"] = mysql_counts["knowledge_base"]
            self.validation_results["mysql_embedding_count"] = mysql_counts["embeddings"]

            # 2. サンプルドキュメント確認
            logger.info("\n[2/4] Validating sample documents...")
            sample_ids = self.fetch_firestore_sample_ids(limit=10)
            await self.validate_sample_documents(sample_ids)

            # 3. Embedding次元数確認
            logger.info("\n[3/4] Validating embedding dimensions...")
            await self.validate_embedding_dimensions(sample_size=5)

            # 4. 整合性チェック
            logger.info("\n[4/4] Checking consistency...")
            count_diff = self.validation_results["firestore_count"] - self.validation_results["mysql_kb_count"]
            count_match = abs(count_diff) <= 5  # 5件以内の誤差を許容

            if count_match:
                logger.info(f"  ✅ Count consistency OK (diff: {count_diff})")
            else:
                logger.warning(f"  ⚠️  Count mismatch: Firestore={self.validation_results['firestore_count']}, MySQL={self.validation_results['mysql_kb_count']}")

            # 結果サマリー
            logger.info("\n" + "=" * 80)
            logger.info("✅ Validation completed!")
            logger.info("=" * 80)
            logger.info(f"Firestore Documents: {self.validation_results['firestore_count']}")
            logger.info(f"MySQL Knowledge Base: {self.validation_results['mysql_kb_count']}")
            logger.info(f"MySQL Embeddings: {self.validation_results['mysql_embedding_count']}")
            logger.info(f"Sample Matches: {len(self.validation_results['sample_matches'])}/{len(sample_ids)}")
            logger.info(f"Missing in MySQL: {len(self.validation_results['missing_in_mysql'])}")
            logger.info(f"Embedding Errors: {len(self.validation_results['embedding_dimension_errors'])}")
            logger.info(f"Other Errors: {len(self.validation_results['errors'])}")
            logger.info("=" * 80)

            # 検証結果判定
            is_valid = (
                count_match
                and len(self.validation_results["missing_in_mysql"]) == 0
                and len(self.validation_results["embedding_dimension_errors"]) == 0
                and len(self.validation_results["errors"]) == 0
            )

            self.validation_results["is_valid"] = is_valid

            if is_valid:
                logger.info("🎉 Migration validation PASSED!")
            else:
                logger.warning("⚠️  Migration validation FAILED - Please review errors above")

            return self.validation_results

        except Exception as e:
            logger.error(f"❌ Validation failed: {e}", exc_info=True)
            self.validation_results["errors"].append(f"Fatal error: {str(e)}")
            self.validation_results["is_valid"] = False
            raise


async def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description="データ移行検証")
    parser.add_argument("--output", type=str, help="検証結果の出力先JSONファイル")

    args = parser.parse_args()

    try:
        # データベース初期化
        logger.info("🔄 Initializing database connection...")
        await init_db()
        logger.info("✅ Database connection initialized")

        # 検証実行
        validator = MigrationValidator()
        results = await validator.validate()

        # 検証結果をファイルに出力
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
            logger.info(f"📄 Results written to {output_path}")

        # 終了コード
        sys.exit(0 if results["is_valid"] else 1)

    except Exception as e:
        logger.error(f"❌ Validation failed: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # データベース接続クローズ
        await close_db()
        logger.info("🔒 Database connection closed")


if __name__ == "__main__":
    asyncio.run(main())
