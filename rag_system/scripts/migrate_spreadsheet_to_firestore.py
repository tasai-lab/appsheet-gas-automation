#!/usr/bin/env python3
"""
SpreadsheetデータをFirestoreに移植

既存のVector DB SpreadsheetからデータとベクトルをFirestoreに移植します。
3072次元ベクトルをPCAで2048次元に圧縮します。

Usage:
    python scripts/migrate_spreadsheet_to_firestore.py --spreadsheet-id SPREADSHEET_ID --dry-run
    python scripts/migrate_spreadsheet_to_firestore.py --spreadsheet-id SPREADSHEET_ID --batch-size 100
    python scripts/migrate_spreadsheet_to_firestore.py --spreadsheet-id SPREADSHEET_ID --project fractal-ecosystem
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
import numpy as np
from sklearn.decomposition import PCA

# 外部ライブラリ
try:
    import google.auth
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from google.cloud import firestore
    from google.cloud.firestore_v1.vector import Vector
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install google-auth google-auth-httplib2 google-api-python-client")
    print("pip install google-cloud-firestore tqdm scikit-learn numpy")
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
TARGET_DIMENSION = 2048  # Firestore制約


class SpreadsheetToFirestoreMigrator:
    """Spreadsheet→Firestore移植クラス"""

    def __init__(
        self,
        spreadsheet_id: str,
        gcp_project_id: str,
        batch_size: int = 100,
        dry_run: bool = False
    ):
        self.spreadsheet_id = spreadsheet_id
        self.gcp_project_id = gcp_project_id
        self.batch_size = batch_size
        self.dry_run = dry_run

        # Google Sheets API クライアント
        self.sheets_service = self._init_sheets_service()

        # Firestore クライアント
        if not dry_run:
            self.db = firestore.Client(project=gcp_project_id)
            self.collection = self.db.collection('knowledge_base')
        else:
            self.db = None
            self.collection = None

        # PCAモデル（初回データで学習）
        self.pca: Optional[PCA] = None

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

    def read_knowledge_base(self) -> List[Dict[str, Any]]:
        """KnowledgeBaseシートを読み込み"""
        try:
            logger.info("📖 KnowledgeBaseシート読み込み開始...")

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
                # 行が短い場合は空文字で埋める
                row_data = row + [''] * (len(headers) - len(row))
                record = dict(zip(headers, row_data))
                data.append(record)

            logger.info(f"✅ {len(data)}件のKnowledgeBaseデータを読み込みました")
            return data

        except Exception as e:
            logger.error(f"KnowledgeBaseシート読み込みエラー: {e}")
            raise

    def read_embeddings(self) -> Dict[str, List[float]]:
        """Embeddingsシートを読み込み（3072次元ベクトル）"""
        try:
            logger.info("📖 Embeddingsシート読み込み開始...")

            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='Embeddings!A:G'
            ).execute()

            values = result.get('values', [])
            if not values:
                logger.warning("Embeddingsシートにデータがありません")
                return {}

            embeddings_dict = {}

            # ヘッダースキップ
            for row in tqdm(values[1:], desc="Embeddings読み込み"):
                if len(row) < 7:
                    logger.warning(f"行データが不完全: {row[:1]}")
                    continue

                kb_id = row[0]
                try:
                    # embedding_part1, part2, part3を結合
                    part1 = json.loads(row[3]) if row[3] else []
                    part2 = json.loads(row[4]) if row[4] else []
                    part3 = json.loads(row[5]) if row[5] else []

                    full_embedding = part1 + part2 + part3

                    if len(full_embedding) != 3072:
                        logger.warning(f"ベクトル次元数が不正: {kb_id} (len={len(full_embedding)})")
                        continue

                    embeddings_dict[kb_id] = full_embedding

                except json.JSONDecodeError as e:
                    logger.error(f"JSONパースエラー: {kb_id} - {e}")
                    continue

            logger.info(f"✅ {len(embeddings_dict)}件のEmbeddingsを読み込みました")
            return embeddings_dict

        except Exception as e:
            logger.error(f"Embeddingsシート読み込みエラー: {e}")
            raise

    def train_pca(self, embeddings: Dict[str, List[float]]):
        """PCAモデルを学習（3072→2048次元）"""
        logger.info("🔧 PCAモデル学習開始...")

        # 全ベクトルを行列に変換
        vectors = list(embeddings.values())
        if not vectors:
            raise ValueError("ベクトルデータがありません")

        X = np.array(vectors)
        logger.info(f"   入力: {X.shape[0]}件 x {X.shape[1]}次元")

        # PCAで2048次元に圧縮
        self.pca = PCA(n_components=TARGET_DIMENSION, random_state=42)
        self.pca.fit(X)

        # 情報保持率を確認
        variance_ratio = self.pca.explained_variance_ratio_.sum()
        logger.info(f"✅ PCA学習完了")
        logger.info(f"   出力: {TARGET_DIMENSION}次元")
        logger.info(f"   情報保持率: {variance_ratio * 100:.2f}%")

    def compress_vector(self, vector: List[float]) -> List[float]:
        """ベクトルを3072→2048次元に圧縮"""
        if self.pca is None:
            raise ValueError("PCAモデルが学習されていません")

        X = np.array([vector])
        compressed = self.pca.transform(X)[0]
        return compressed.tolist()

    def migrate_to_firestore(
        self,
        knowledge_base_data: List[Dict[str, Any]],
        embeddings_dict: Dict[str, List[float]]
    ):
        """FirestoreのknowledgeBaseコレクションに移植"""

        if self.dry_run:
            logger.info("🔍 DRY RUN モード: Firestoreへの書き込みはスキップします")

        logger.info(f"🚀 Firestore移植開始...")
        logger.info(f"   プロジェクト: {self.gcp_project_id}")
        logger.info(f"   コレクション: knowledge_base")
        logger.info(f"   バッチサイズ: {self.batch_size}")

        for i in tqdm(range(0, len(knowledge_base_data), self.batch_size), desc="Firestore書き込み"):
            batch_data = knowledge_base_data[i:i + self.batch_size]

            if self.dry_run:
                # DRY RUN: 統計のみ更新
                for record in batch_data:
                    kb_id = record.get('id')
                    if kb_id in embeddings_dict:
                        self.stats['success'] += 1
                    else:
                        self.stats['skipped'] += 1
                    self.stats['total'] += 1
                continue

            # Firestoreバッチ書き込み
            batch = self.db.batch()

            for record in batch_data:
                kb_id = record.get('id')
                if not kb_id:
                    logger.warning("IDが見つかりません")
                    self.stats['skipped'] += 1
                    continue

                # ベクトル取得
                embedding_3072 = embeddings_dict.get(kb_id)
                if not embedding_3072:
                    logger.warning(f"ベクトルが見つかりません: {kb_id}")
                    self.stats['skipped'] += 1
                    continue

                try:
                    # PCA圧縮
                    embedding_2048 = self.compress_vector(embedding_3072)

                    # Firestore形式に変換
                    metadata_str = record.get('metadata', '{}')
                    metadata = json.loads(metadata_str) if metadata_str else {}

                    structured_data_str = record.get('structured_data', '{}')
                    structured_data = json.loads(structured_data_str) if structured_data_str else {}

                    # Firestoreドキュメント
                    doc_ref = self.collection.document(kb_id)
                    doc_data = {
                        'id': kb_id,
                        'domain': record.get('domain', ''),
                        'source_type': record.get('source_type', ''),
                        'source_table': record.get('source_table', ''),
                        'source_id': record.get('source_id', ''),
                        'user_id': record.get('user_id', ''),
                        'title': record.get('title', ''),
                        'content': record.get('content', ''),
                        'structured_data': structured_data,
                        'metadata': metadata,
                        'embedding': Vector(embedding_2048),
                        'created_at': firestore.SERVER_TIMESTAMP,
                        'updated_at': firestore.SERVER_TIMESTAMP,
                    }

                    batch.set(doc_ref, doc_data)
                    self.stats['success'] += 1

                except Exception as e:
                    logger.error(f"ドキュメント作成エラー: {kb_id} - {e}")
                    self.stats['errors'] += 1

                self.stats['total'] += 1

            # バッチコミット
            try:
                batch.commit()
            except Exception as e:
                logger.error(f"バッチコミットエラー: {e}")
                self.stats['errors'] += len(batch_data)

            # レート制限回避
            time.sleep(0.1)

        logger.info("✅ Firestore移植完了")

    def run(self):
        """移植実行"""
        try:
            logger.info("=" * 60)
            logger.info("🚀 Spreadsheet→Firestore移植開始")
            logger.info("=" * 60)
            logger.info(f"Spreadsheet ID: {self.spreadsheet_id}")
            logger.info(f"GCP Project: {self.gcp_project_id}")
            logger.info(f"Dry Run: {self.dry_run}")
            logger.info("")

            # 1. KnowledgeBase読み込み
            knowledge_base_data = self.read_knowledge_base()
            if not knowledge_base_data:
                logger.error("KnowledgeBaseにデータがありません")
                return

            # 2. Embeddings読み込み
            embeddings_dict = self.read_embeddings()
            if not embeddings_dict:
                logger.error("Embeddingsにデータがありません")
                return

            # 3. PCA学習
            self.train_pca(embeddings_dict)

            # 4. Firestore移植
            self.migrate_to_firestore(knowledge_base_data, embeddings_dict)

            # 統計表示
            duration = (datetime.now() - self.stats['start_time']).total_seconds()
            logger.info("")
            logger.info("=" * 60)
            logger.info("📊 移植統計")
            logger.info("=" * 60)
            logger.info(f"合計件数: {self.stats['total']}")
            logger.info(f"成功: {self.stats['success']}")
            logger.info(f"スキップ: {self.stats['skipped']}")
            logger.info(f"エラー: {self.stats['errors']}")
            logger.info(f"実行時間: {duration:.1f}秒")

            if self.stats['total'] > 0:
                success_rate = (self.stats['success'] / self.stats['total']) * 100
                logger.info(f"成功率: {success_rate:.1f}%")

        except Exception as e:
            logger.error(f"移植実行エラー: {e}", exc_info=True)
            raise


def main():
    parser = argparse.ArgumentParser(description='SpreadsheetデータをFirestoreに移植')
    parser.add_argument('--spreadsheet-id', required=True, help='Spreadsheet ID')
    parser.add_argument('--project', default=GCP_PROJECT_ID, help='GCP Project ID')
    parser.add_argument('--batch-size', type=int, default=100, help='バッチサイズ')
    parser.add_argument('--dry-run', action='store_true', help='DRY RUNモード（書き込みなし）')
    args = parser.parse_args()

    migrator = SpreadsheetToFirestoreMigrator(
        spreadsheet_id=args.spreadsheet_id,
        gcp_project_id=args.project,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    migrator.run()


if __name__ == "__main__":
    main()
