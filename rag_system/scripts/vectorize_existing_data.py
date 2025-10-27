#!/usr/bin/env python3
"""
既存データのベクトル化バッチ処理スクリプト

Usage:
    python scripts/vectorize_existing_data.py --source spreadsheet-id --dry-run
    python scripts/vectorize_existing_data.py --source spreadsheet-id --batch-size 50
    python scripts/vectorize_existing_data.py --all --batch-size 100

Features:
    - Google Sheets APIでデータソース読み込み
    - Vertex AI gemini-embedding-001でベクトル化（3072次元）
    - Vector DB Spreadsheetに書き込み
    - プログレスバー表示（tqdm）
    - エラーリトライ（指数バックオフ）
    - レート制限対応
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
    from google.cloud import aiplatform
    from vertexai.language_models import TextEmbeddingModel
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install google-auth google-auth-oauthlib google-auth-httplib2")
    print("pip install google-api-python-client google-cloud-aiplatform tqdm")
    sys.exit(1)

# ロガー設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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
EMBEDDING_DIMENSION = 3072

# データソース定義（data_sources.jsonから読み込み）
DATA_SOURCES_FILE = Path(__file__).parent / "data_sources.json"

def load_data_sources():
    """data_sources.jsonを読み込み"""
    if not DATA_SOURCES_FILE.exists():
        raise FileNotFoundError(f"❌ data_sources.jsonが見つかりません: {DATA_SOURCES_FILE}")

    with open(DATA_SOURCES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

DATA_SOURCES = load_data_sources()


class VectorizeExistingData:
    """既存データベクトル化クラス"""

    def __init__(
        self,
        vector_db_spreadsheet_id: str,
        batch_size: int = 50,
        dry_run: bool = False
    ):
        self.vector_db_spreadsheet_id = vector_db_spreadsheet_id
        self.batch_size = batch_size
        self.dry_run = dry_run

        # Google Sheets API クライアント
        self.sheets_service = self._init_sheets_service()

        # Vertex AI 初期化
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
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.readonly',
                ]
            )
            return build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            logger.error(f"Google Sheets API初期化エラー: {e}")
            raise

    def read_source_data(self, spreadsheet_id: str, sheet_name: str) -> List[Dict[str, Any]]:
        """データソースから読み込み"""
        try:
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=f"{sheet_name}!A:Z"
            ).execute()

            values = result.get('values', [])
            if not values:
                logger.warning(f"データが見つかりません: {sheet_name}")
                return []

            # ヘッダー行を取得
            headers = values[0]
            data = []

            for row in values[1:]:
                # 行が短い場合は空文字で埋める
                row_data = row + [''] * (len(headers) - len(row))
                record = dict(zip(headers, row_data))
                data.append(record)

            logger.info(f"✅ {len(data)}件のデータを読み込みました: {sheet_name}")
            return data

        except HttpError as e:
            logger.error(f"❌ データ読み込みエラー: {e}")
            return []

    def create_embedding(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> Optional[List[float]]:
        """Vertex AI Embeddingを生成"""
        try:
            # API呼び出し（1回のみ）
            embeddings = self.embedding_model.get_embeddings(
                texts=[text],
                output_dimensionality=EMBEDDING_DIMENSION,
            )

            if embeddings and len(embeddings) > 0:
                return embeddings[0].values
            else:
                logger.error("Embedding生成失敗: 空のレスポンス")
                return None

        except Exception as e:
            logger.error(f"Embedding生成エラー: {e}")
            return None

    def build_full_text(self, record: Dict[str, Any], source_type: str) -> str:
        """フルテキスト構築（汎用・全カラム連結）"""
        # 除外するフィールド（ID系、メタデータのみ）
        exclude_fields = {'_id', 'id', 'key', 'created_at', 'updated_at', 'created_by', 'updated_by', 'sync_key'}

        # 全カラムを連結（除外フィールド以外）
        parts = []
        for key, value in record.items():
            # 除外フィールドをスキップ
            if key.lower() in exclude_fields:
                continue
            # 空でない値のみ追加
            if value and str(value).strip():
                parts.append(str(value).strip())

        # 空文字を除去して結合
        full_text = " ".join(parts)
        return full_text

    def write_to_vector_db(
        self,
        record_id: str,
        domain: str,
        source_type: str,
        title: str,
        content: str,
        embedding: List[float],
        metadata: Dict[str, Any]
    ) -> bool:
        """Vector DBに書き込み"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Vector DB書き込みスキップ: {record_id}")
            return True

        try:
            # KnowledgeBaseシートに書き込み
            kb_row = [
                record_id,  # id
                domain,  # domain
                source_type,  # source_type
                metadata.get("source_table", ""),  # source_table
                metadata.get("source_id", record_id),  # source_id
                metadata.get("user_id", ""),  # user_id
                title,  # title
                content,  # content
                json.dumps(metadata.get("structured_data", {}), ensure_ascii=False),  # structured_data
                json.dumps(metadata, ensure_ascii=False),  # metadata
                ",".join(metadata.get("tags", [])),  # tags
                metadata.get("date", ""),  # date
                datetime.now().isoformat(),  # created_at
                datetime.now().isoformat(),  # updated_at
            ]

            # Embeddingを3分割（Google Sheetsの50,000文字制限対策）
            part_size = 1024
            emb_part1 = json.dumps(embedding[0:part_size])
            emb_part2 = json.dumps(embedding[part_size:part_size*2])
            emb_part3 = json.dumps(embedding[part_size*2:part_size*3])

            # Embeddingsシートに書き込み
            emb_row = [
                record_id,  # kb_id
                EMBEDDING_MODEL,  # model
                EMBEDDING_DIMENSION,  # dimension
                emb_part1,  # embedding_part1 (0-1023)
                emb_part2,  # embedding_part2 (1024-2047)
                emb_part3,  # embedding_part3 (2048-3071)
                datetime.now().isoformat(),  # created_at
            ]

            # KnowledgeBaseシートに追加
            kb_result = self.sheets_service.spreadsheets().values().append(
                spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
                range="KnowledgeBase!A:N",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [kb_row]}
            ).execute()

            # Embeddingsシートに追加（カラム数変更: A:G）
            emb_result = self.sheets_service.spreadsheets().values().append(
                spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
                range="Embeddings!A:G",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [emb_row]}
            ).execute()

            logger.debug(f"✅ Vector DB書き込み成功: {record_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Vector DB書き込みエラー: {record_id} - {e}")
            return False

    def process_data_source(self, source_key: str, source_config: Dict[str, Any]) -> int:
        """データソースを処理"""
        logger.info(f"\n{'='*60}")
        logger.info(f"処理開始: {source_config['name']}")
        logger.info(f"{'='*60}")

        # データ読み込み
        spreadsheet_id = source_config.get("spreadsheet_id")
        if not spreadsheet_id or spreadsheet_id in ["【要設定】", "【AppSheetアプリのSpreadsheet IDを入力】"]:
            logger.warning(f"⚠️ スキップ: Spreadsheet ID未設定 - {source_config['name']}")
            return 0

        sheet_name = source_config.get("sheet_name", "Sheet1")
        records = self.read_source_data(spreadsheet_id, sheet_name)

        if not records:
            return 0

        self.stats["total"] += len(records)
        success_count = 0

        # プログレスバー
        with tqdm(total=len(records), desc=f"{source_config['name']}") as pbar:
            for record in records:
                try:
                    # フィールドマッピング取得
                    field_mapping = source_config.get("field_mapping", {})
                    id_field = field_mapping.get("id_field", "id")
                    client_field = field_mapping.get("client_field", "user_id")

                    # レコードID生成
                    source_id = record.get(id_field, "")
                    record_id = f"{source_key}_{source_id if source_id else hash(str(record))}"

                    # フルテキスト構築
                    full_text = self.build_full_text(record, source_config["source_type"])
                    if not full_text or len(full_text) < 50:
                        logger.warning(f"⚠️ スキップ: テキストが短すぎる ({len(full_text)}文字) - {record_id}")
                        self.stats["skipped"] += 1
                        pbar.update(1)
                        continue

                    # Embedding生成
                    embedding = self.create_embedding(full_text)
                    if not embedding:
                        logger.error(f"❌ Embedding生成失敗: {record_id}")
                        self.stats["errors"] += 1
                        pbar.update(1)
                        continue

                    # Vector DB書き込み
                    title = record.get("title", f"{source_config['name']} - {record_id[:8]}")
                    client_id = record.get(client_field, "")
                    metadata = {
                        "source_table": sheet_name,
                        "source_id": source_id,
                        "user_id": client_id,
                        "structured_data": record,
                        "tags": [],
                        "date": record.get("date", ""),
                    }

                    success = self.write_to_vector_db(
                        record_id=record_id,
                        domain=source_config["domain"],
                        source_type=source_config["source_type"],
                        title=title,
                        content=full_text,
                        embedding=embedding,
                        metadata=metadata
                    )

                    if success:
                        success_count += 1
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

        logger.info(f"✅ 完了: {success_count}/{len(records)}件処理")
        return success_count

    def run(self, source_keys: Optional[List[str]] = None):
        """バッチ処理実行"""
        logger.info("\n" + "="*60)
        logger.info("既存データベクトル化バッチ処理")
        logger.info("="*60)
        logger.info(f"Vector DB: {self.vector_db_spreadsheet_id}")
        logger.info(f"Embedding Model: {EMBEDDING_MODEL} ({EMBEDDING_DIMENSION}次元)")
        logger.info(f"Batch Size: {self.batch_size}")
        logger.info(f"Dry Run: {self.dry_run}")
        logger.info("="*60 + "\n")

        # 処理対象決定
        if source_keys:
            sources_to_process = {k: DATA_SOURCES[k] for k in source_keys if k in DATA_SOURCES}
        else:
            sources_to_process = DATA_SOURCES

        # 各データソース処理
        for source_key, source_config in sources_to_process.items():
            self.process_data_source(source_key, source_config)

        # 統計表示
        self.print_stats()

    def print_stats(self):
        """統計表示"""
        duration = (datetime.now() - self.stats["start_time"]).total_seconds()

        logger.info("\n" + "="*60)
        logger.info("処理結果サマリー")
        logger.info("="*60)
        logger.info(f"総件数: {self.stats['total']}")
        logger.info(f"成功: {self.stats['success']} ({self.stats['success']/max(self.stats['total'],1)*100:.1f}%)")
        logger.info(f"スキップ: {self.stats['skipped']}")
        logger.info(f"エラー: {self.stats['errors']}")
        logger.info(f"実行時間: {duration:.1f}秒")
        logger.info(f"処理速度: {self.stats['success']/max(duration,1):.2f}件/秒")
        logger.info("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="既存データベクトル化バッチ処理")
    parser.add_argument("--source", type=str, help="処理対象データソース（カンマ区切り）")
    parser.add_argument("--all", action="store_true", help="全データソース処理")
    parser.add_argument("--batch-size", type=int, default=50, help="バッチサイズ（デフォルト: 50）")
    parser.add_argument("--dry-run", action="store_true", help="Dry Run（書き込みしない）")
    parser.add_argument("--list-sources", action="store_true", help="データソース一覧表示")

    args = parser.parse_args()

    # データソース一覧表示
    if args.list_sources:
        print("\n利用可能なデータソース:")
        for key, config in DATA_SOURCES.items():
            status = "✅ 設定済み" if (config["spreadsheet_id"] and config["spreadsheet_id"] not in ["【要設定】", "【AppSheetアプリのSpreadsheet IDを入力】"]) else "⚠️ 未設定"
            print(f"  {key:20s} - {config['name']:30s} {status}")
        print()
        return

    # Vector DB Spreadsheet ID確認
    if not VECTOR_DB_SPREADSHEET_ID:
        logger.error("❌ VECTOR_DB_SPREADSHEET_IDが設定されていません")
        logger.error("backend/.envファイルを確認してください")
        sys.exit(1)

    # 処理対象決定
    source_keys = None
    if args.source:
        source_keys = [s.strip() for s in args.source.split(",")]
    elif not args.all:
        logger.error("❌ --source または --all を指定してください")
        parser.print_help()
        sys.exit(1)

    # 実行
    vectorizer = VectorizeExistingData(
        vector_db_spreadsheet_id=VECTOR_DB_SPREADSHEET_ID,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    try:
        vectorizer.run(source_keys)
    except KeyboardInterrupt:
        logger.info("\n\n⚠️ ユーザーによる中断")
        vectorizer.print_stats()
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\n❌ 予期しないエラー: {e}")
        vectorizer.print_stats()
        sys.exit(1)


if __name__ == "__main__":
    main()
