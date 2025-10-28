#!/usr/bin/env python3
"""
SpreadsheetからFirestore Vector Searchへのデータ移行スクリプト

機能:
- Spreadsheetからベクトルデータを読み込み
- 3072次元 → 2048次元に再ベクトル化（Firestore制約）
- Firestoreに書き込み（Vectorフィールド使用）
- プログレスバー・エラーハンドリング・レジューム機能

Usage:
    # Dry run（書き込みしない）
    python scripts/migrate_to_firestore_vectors.py --dry-run

    # 本番実行
    python scripts/migrate_to_firestore_vectors.py

    # バッチサイズ指定
    python scripts/migrate_to_firestore_vectors.py --batch-size 100

    # 特定範囲のみ（レジューム）
    python scripts/migrate_to_firestore_vectors.py --skip 1000 --limit 500
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

# 外部ライブラリ
try:
    import google.auth
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from google.cloud import firestore
    from google.cloud.firestore_v1.vector import Vector
    from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
    from google.cloud import aiplatform
    from vertexai.language_models import TextEmbeddingModel
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install google-auth google-auth-oauthlib google-auth-httplib2")
    print("pip install google-api-python-client google-cloud-firestore google-cloud-aiplatform tqdm")
    sys.exit(1)

# ロガー設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# プロジェクトルート
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 環境変数読み込み
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / "backend" / ".env")

# 設定
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "fractal-ecosystem")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
VECTOR_DB_SPREADSHEET_ID = os.getenv("VECTOR_DB_SPREADSHEET_ID")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")

# Firestore制約: 最大2048次元
FIRESTORE_MAX_DIMENSION = 2048
EMBEDDING_DIMENSION = FIRESTORE_MAX_DIMENSION  # 2048次元に変更

# Firestoreコレクション名
FIRESTORE_COLLECTION = "knowledge_base"


class FirestoreVectorMigration:
    """Firestore Vector Search移行クラス"""

    def __init__(
        self,
        spreadsheet_id: str,
        batch_size: int = 50,
        dry_run: bool = False,
        skip: int = 0,
        limit: Optional[int] = None
    ):
        self.spreadsheet_id = spreadsheet_id
        self.batch_size = batch_size
        self.dry_run = dry_run
        self.skip = skip
        self.limit = limit

        # Google Sheets API
        self.sheets_service = self._init_sheets_service()

        # Firestore
        self.db = firestore.AsyncClient(project=GCP_PROJECT_ID)

        # Vertex AI
        aiplatform.init(project=GCP_PROJECT_ID, location=GCP_LOCATION)
        self.embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)

        # 統計
        self.stats = {
            "total": 0,
            "success": 0,
            "skipped": 0,
            "errors": 0,
            "start_time": datetime.now(),
        }

    def _init_sheets_service(self):
        """Google Sheets API クライアント初期化"""
        try:
            credentials, project = google.auth.default(
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets.readonly',
                    'https://www.googleapis.com/auth/drive.readonly',
                ]
            )
            return build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            logger.error(f"Google Sheets API初期化エラー: {e}")
            raise

    def read_spreadsheet_data(self) -> List[Dict[str, Any]]:
        """
        SpreadsheetからKnowledgeBaseとEmbeddingsを読み込み

        ※ タイムアウト回避のため、バッチ読み込みを使用
        """
        logger.info("=== Spreadsheetデータ読み込み開始 ===")

        try:
            # 既存のbackend実装を参考に、バッチリクエストを使用
            # KnowledgeBaseシート読み込み（範囲指定）
            kb_range = "KnowledgeBase!A1:N"  # 最大範囲を指定（N列まで）
            emb_range = "Embeddings!A1:G"    # Embeddings（G列まで）

            # バッチリクエストで同時取得
            batch_result = self.sheets_service.spreadsheets().values().batchGet(
                spreadsheetId=self.spreadsheet_id,
                ranges=[kb_range, emb_range]
            ).execute()

            value_ranges = batch_result.get('valueRanges', [])
            if len(value_ranges) < 2:
                logger.error("❌ Spreadsheetデータ取得失敗")
                return []

            # KnowledgeBase データ
            kb_values = value_ranges[0].get('values', [])
            if not kb_values:
                logger.warning("KnowledgeBaseシートにデータがありません")
                return []

            # Embeddings データ
            emb_values = value_ranges[1].get('values', [])
            if not emb_values:
                logger.warning("Embeddingsシートにデータがありません")
                return []

            # ヘッダー取得
            kb_headers = kb_values[0]
            emb_headers = emb_values[0]

            # KnowledgeBase データを辞書に
            kb_data = {}
            for row in kb_values[1:]:
                if not row:
                    continue
                row_data = row + [''] * (len(kb_headers) - len(row))
                record = dict(zip(kb_headers, row_data))
                record_id = record.get('id')
                if record_id:
                    kb_data[record_id] = record

            logger.info(f"✅ KnowledgeBase: {len(kb_data)}件")

            # Embeddings データ（kb_idをキーにマッピング）
            emb_data = {}
            for row in emb_values[1:]:
                if not row or len(row) < 7:
                    continue
                row_data = row + [''] * (len(emb_headers) - len(row))
                record = dict(zip(emb_headers, row_data))
                kb_id = record.get('kb_id')
                if kb_id:
                    emb_data[kb_id] = record

            logger.info(f"✅ Embeddings: {len(emb_data)}件")

            # 統合（KnowledgeBase + Embeddings）
            merged_data = []
            for kb_id, kb_record in kb_data.items():
                emb_record = emb_data.get(kb_id)
                if emb_record:
                    merged_record = {**kb_record, **emb_record}
                    merged_data.append(merged_record)
                else:
                    # Embeddingがないレコードもスキップせず含める（後で再生成）
                    merged_record = {**kb_record}
                    merged_data.append(merged_record)

            logger.info(f"✅ 統合データ: {len(merged_data)}件")

            # スキップ・リミット適用
            if self.skip > 0:
                merged_data = merged_data[self.skip:]
                logger.info(f"Skip: {self.skip}件")

            if self.limit:
                merged_data = merged_data[:self.limit]
                logger.info(f"Limit: {self.limit}件")

            return merged_data

        except HttpError as e:
            logger.error(f"❌ Spreadsheet読み込みエラー: {e}", exc_info=True)
            return []
        except Exception as e:
            logger.error(f"❌ データ読み込み予期しないエラー: {e}", exc_info=True)
            return []

    def reconstruct_embedding(self, emb_record: Dict[str, Any]) -> Optional[List[float]]:
        """Spreadsheetの3分割Embeddingを復元（3072次元）"""
        try:
            part1_str = emb_record.get('embedding_part1', '[]')
            part2_str = emb_record.get('embedding_part2', '[]')
            part3_str = emb_record.get('embedding_part3', '[]')

            part1 = json.loads(part1_str) if part1_str else []
            part2 = json.loads(part2_str) if part2_str else []
            part3 = json.loads(part3_str) if part3_str else []

            # 結合
            embedding = part1 + part2 + part3

            if len(embedding) != 3072:
                logger.warning(f"⚠️ Embedding次元数が不正: {len(embedding)}次元（期待: 3072）")
                return None

            return embedding

        except Exception as e:
            logger.error(f"Embedding復元エラー: {e}")
            return None

    def create_embedding_2048(self, text: str) -> Optional[List[float]]:
        """2048次元の新しいEmbeddingを生成（Firestore対応）"""
        try:
            # ★★★ API呼び出し: 1回のみ実行 ★★★
            embeddings = self.embedding_model.get_embeddings(
                texts=[text],
                output_dimensionality=EMBEDDING_DIMENSION,  # 2048次元
            )

            if embeddings and len(embeddings) > 0:
                vector = embeddings[0].values
                if len(vector) != EMBEDDING_DIMENSION:
                    logger.error(f"Embedding次元数エラー: {len(vector)}次元（期待: {EMBEDDING_DIMENSION}）")
                    return None
                return vector
            else:
                logger.error("Embedding生成失敗: 空のレスポンス")
                return None

        except Exception as e:
            logger.error(f"Embedding生成エラー: {e}")
            return None

    async def write_to_firestore(self, record: Dict[str, Any], embedding: List[float]) -> bool:
        """Firestoreに書き込み"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Firestore書き込みスキップ: {record.get('id')}")
            return True

        try:
            record_id = record.get('id')
            if not record_id:
                logger.error("record_idが空です")
                return False

            # メタデータ・structured_dataをパース
            metadata = {}
            structured_data = {}
            try:
                metadata_str = record.get('metadata', '{}')
                metadata = json.loads(metadata_str) if metadata_str else {}
            except:
                pass

            try:
                structured_data_str = record.get('structured_data', '{}')
                structured_data = json.loads(structured_data_str) if structured_data_str else {}
            except:
                pass

            # タグを配列に変換
            tags_str = record.get('tags', '')
            tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

            # Firestoreドキュメント
            doc_data = {
                'id': record_id,
                'domain': record.get('domain', ''),
                'source_type': record.get('source_type', ''),
                'source_table': record.get('source_table', ''),
                'source_id': record.get('source_id', ''),
                'user_id': record.get('user_id', ''),
                'title': record.get('title', ''),
                'content': record.get('content', ''),
                'structured_data': structured_data,
                'metadata': metadata,
                'tags': tags,
                'date': record.get('date', ''),
                'embedding': Vector(embedding),  # Vectorフィールド
                'embedding_model': EMBEDDING_MODEL,
                'embedding_dimension': EMBEDDING_DIMENSION,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP,
            }

            # Firestoreに書き込み
            doc_ref = self.db.collection(FIRESTORE_COLLECTION).document(record_id)
            await doc_ref.set(doc_data)

            logger.debug(f"✅ Firestore書き込み成功: {record_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Firestore書き込みエラー: {record.get('id')} - {e}")
            return False

    async def migrate(self):
        """移行メイン処理"""
        logger.info("\n" + "="*60)
        logger.info("Firestore Vector Search 移行処理")
        logger.info("="*60)
        logger.info(f"Spreadsheet ID: {self.spreadsheet_id}")
        logger.info(f"Firestore Collection: {FIRESTORE_COLLECTION}")
        logger.info(f"Embedding Model: {EMBEDDING_MODEL}")
        logger.info(f"Embedding Dimension: {EMBEDDING_DIMENSION} (Firestore制約)")
        logger.info(f"Batch Size: {self.batch_size}")
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info(f"Skip: {self.skip}, Limit: {self.limit}")
        logger.info("="*60 + "\n")

        # Spreadsheetデータ読み込み
        records = self.read_spreadsheet_data()
        if not records:
            logger.error("移行対象データがありません")
            return

        self.stats["total"] = len(records)

        # プログレスバー
        with tqdm(total=len(records), desc="移行処理") as pbar:
            for record in records:
                try:
                    record_id = record.get('id')
                    content = record.get('content', '')

                    # 空のコンテンツはスキップ
                    if not content or len(content) < 50:
                        logger.warning(f"⚠️ スキップ: コンテンツが短すぎる ({len(content)}文字) - {record_id}")
                        self.stats["skipped"] += 1
                        pbar.update(1)
                        continue

                    # ★★★ 2048次元の新しいEmbeddingを生成 ★★★
                    embedding = self.create_embedding_2048(content)
                    if not embedding:
                        logger.error(f"❌ Embedding生成失敗: {record_id}")
                        self.stats["errors"] += 1
                        pbar.update(1)
                        continue

                    # Firestoreに書き込み
                    success = await self.write_to_firestore(record, embedding)
                    if success:
                        self.stats["success"] += 1
                    else:
                        self.stats["errors"] += 1

                    # レート制限対応（60 RPM = 1秒間隔）
                    time.sleep(1)

                except Exception as e:
                    logger.error(f"❌ レコード処理エラー: {e}")
                    self.stats["errors"] += 1

                finally:
                    pbar.update(1)

        # 統計表示
        self.print_stats()

    def print_stats(self):
        """統計表示"""
        duration = (datetime.now() - self.stats["start_time"]).total_seconds()

        logger.info("\n" + "="*60)
        logger.info("移行結果サマリー")
        logger.info("="*60)
        logger.info(f"総件数: {self.stats['total']}")
        logger.info(f"成功: {self.stats['success']} ({self.stats['success']/max(self.stats['total'],1)*100:.1f}%)")
        logger.info(f"スキップ: {self.stats['skipped']}")
        logger.info(f"エラー: {self.stats['errors']}")
        logger.info(f"実行時間: {duration:.1f}秒")
        logger.info(f"処理速度: {self.stats['success']/max(duration,1):.2f}件/秒")
        logger.info("="*60 + "\n")


async def main_async():
    parser = argparse.ArgumentParser(description="Firestore Vector Search移行処理")
    parser.add_argument("--batch-size", type=int, default=50, help="バッチサイズ（デフォルト: 50）")
    parser.add_argument("--dry-run", action="store_true", help="Dry Run（書き込みしない）")
    parser.add_argument("--skip", type=int, default=0, help="スキップ件数（レジューム用）")
    parser.add_argument("--limit", type=int, help="処理上限件数（テスト用）")

    args = parser.parse_args()

    # Vector DB Spreadsheet ID確認
    if not VECTOR_DB_SPREADSHEET_ID:
        logger.error("❌ VECTOR_DB_SPREADSHEET_IDが設定されていません")
        logger.error("backend/.envファイルを確認してください")
        sys.exit(1)

    # 実行
    migration = FirestoreVectorMigration(
        spreadsheet_id=VECTOR_DB_SPREADSHEET_ID,
        batch_size=args.batch_size,
        dry_run=args.dry_run,
        skip=args.skip,
        limit=args.limit
    )

    try:
        await migration.migrate()
    except KeyboardInterrupt:
        logger.info("\n\n⚠️ ユーザーによる中断")
        migration.print_stats()
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\n❌ 予期しないエラー: {e}", exc_info=True)
        migration.print_stats()
        sys.exit(1)


def main():
    import asyncio
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
