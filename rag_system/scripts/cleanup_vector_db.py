#!/usr/bin/env python3
"""
Vector DB Spreadsheetのクリーンアップスクリプト

機能:
1. KnowledgeBaseシートで重複している行を削除（embeddingされていない行）
2. Embeddingsシートのヘッダーを確認・追加
"""

import os
import sys
import logging
from datetime import datetime
from typing import Dict, List, Set, Any

# Google API
import google.auth
from googleapiclient.discovery import build

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 定数
VECTOR_DB_SPREADSHEET_ID = "1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA"
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]


class VectorDBCleaner:
    """Vector DBクリーナー"""

    def __init__(self):
        """初期化"""
        # 認証情報の取得（デフォルト認証）
        try:
            credentials, project = google.auth.default(scopes=SCOPES)
            logger.info(f"認証成功: project={project}")
        except Exception as e:
            logger.error(f"認証エラー: {e}")
            raise

        # Google Sheets API
        self.sheets_service = build('sheets', 'v4', credentials=credentials)
        self.spreadsheet_id = VECTOR_DB_SPREADSHEET_ID

        # シートIDキャッシュ
        self._sheet_id_cache = {}

    def get_sheet_data(self, sheet_name: str, range_notation: str) -> List[List[Any]]:
        """シートからデータを取得"""
        try:
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!{range_notation}"
            ).execute()

            return result.get('values', [])

        except Exception as e:
            logger.error(f"データ取得エラー ({sheet_name}): {e}")
            return []

    def update_embeddings_header(self) -> bool:
        """Embeddingsシートのヘッダーを更新"""
        logger.info("=== Embeddingsシートのヘッダー確認・更新 ===")

        try:
            # 現在のヘッダーを取得
            current_header = self.get_sheet_data("Embeddings", "A1:Z1")

            if not current_header:
                logger.warning("Embeddingsシートにヘッダーがありません")
                current_header = [[]]

            current_cols = current_header[0] if current_header else []
            logger.info(f"現在のヘッダー ({len(current_cols)}列): {current_cols}")

            # 期待されるヘッダー
            expected_header = [
                'kb_id',
                'model',
                'dimension',
                'embedding_part1',
                'embedding_part2',
                'embedding_part3',
                'created_at'
            ]

            # ヘッダーが一致しているか確認
            if current_cols == expected_header:
                logger.info("✅ ヘッダーは既に正しい形式です")
                return True

            # ヘッダーを更新
            logger.info(f"ヘッダーを更新: {expected_header}")
            self.sheets_service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range="Embeddings!A1:G1",
                valueInputOption="USER_ENTERED",
                body={'values': [expected_header]}
            ).execute()

            logger.info("✅ ヘッダーを更新しました")
            return True

        except Exception as e:
            logger.error(f"ヘッダー更新エラー: {e}")
            return False

    def get_knowledgebase_stats(self) -> Dict[str, int]:
        """KnowledgeBaseシートの統計情報を取得"""
        logger.info("=== KnowledgeBaseシートの統計情報 ===")

        # 全データを取得
        kb_data = self.get_sheet_data("KnowledgeBase", "A2:Z")

        if not kb_data:
            logger.info("KnowledgeBaseシートにデータがありません")
            return {'total': 0, 'with_embedding': 0, 'without_embedding': 0}

        total = len(kb_data)
        with_embedding = 0
        without_embedding = 0

        # embedding_idカラム（通常はG列 = インデックス6）を確認
        for row in kb_data:
            # G列: embedding_id
            if len(row) > 6 and row[6]:  # embedding_idが存在
                with_embedding += 1
            else:
                without_embedding += 1

        logger.info(f"総行数: {total}")
        logger.info(f"embedding_id あり: {with_embedding}")
        logger.info(f"embedding_id なし: {without_embedding}")

        return {
            'total': total,
            'with_embedding': with_embedding,
            'without_embedding': without_embedding
        }

    def get_embeddings_kb_ids(self) -> Set[str]:
        """Embeddingsシートに存在するkb_idのセットを取得"""
        logger.info("=== Embeddingsシートのkb_id取得 ===")

        # A列（kb_id）を取得
        emb_data = self.get_sheet_data("Embeddings", "A2:A")

        if not emb_data:
            logger.warning("Embeddingsシートにデータがありません")
            return set()

        kb_ids = {row[0] for row in emb_data if row}
        logger.info(f"Embeddingsシートのkb_id数: {len(kb_ids)}")

        return kb_ids

    def delete_rows_without_embedding(self, dry_run: bool = True) -> int:
        """Embeddingがない行を削除"""
        logger.info(f"=== Embeddingがない行の削除 (dry_run={dry_run}) ===")

        try:
            # KnowledgeBaseのデータを取得
            kb_data = self.get_sheet_data("KnowledgeBase", "A2:Z")

            if not kb_data:
                logger.info("KnowledgeBaseシートにデータがありません")
                return 0

            # Embeddingsのkb_idセットを取得
            emb_kb_ids = self.get_embeddings_kb_ids()

            # 削除対象の行番号を収集（逆順）
            rows_to_delete = []

            for idx, row in enumerate(kb_data):
                row_number = idx + 2  # ヘッダー行を考慮（1ベース）

                # A列: id (kb_id)
                if not row:
                    continue

                kb_id = row[0] if len(row) > 0 else None

                # kb_idがEmbeddingsシートに存在しない場合
                if kb_id and kb_id not in emb_kb_ids:
                    rows_to_delete.append((row_number, kb_id))

            if not rows_to_delete:
                logger.info("✅ 削除対象の行はありません")
                return 0

            logger.info(f"削除対象の行数: {len(rows_to_delete)}")

            if dry_run:
                logger.info("--- Dry Runモード: 以下の行が削除されます ---")
                for row_num, kb_id in rows_to_delete[:10]:  # 最初の10行のみ表示
                    logger.info(f"  行 {row_num}: kb_id={kb_id}")
                if len(rows_to_delete) > 10:
                    logger.info(f"  ... 他 {len(rows_to_delete) - 10} 行")
                return len(rows_to_delete)

            # 実際に削除（逆順で削除）
            logger.info("削除を実行します...")

            # バッチリクエストで削除
            requests = []
            for row_num, kb_id in reversed(rows_to_delete):
                requests.append({
                    'deleteDimension': {
                        'range': {
                            'sheetId': self._get_sheet_id('KnowledgeBase'),
                            'dimension': 'ROWS',
                            'startIndex': row_num - 1,  # 0ベース
                            'endIndex': row_num
                        }
                    }
                })

            # バッチで削除（100行ずつ、レート制限対応）
            import time
            batch_size = 100
            deleted_count = 0

            for i in range(0, len(requests), batch_size):
                batch_requests = requests[i:i+batch_size]

                # レート制限対応: 60秒間隔
                if i > 0:
                    logger.info("レート制限対応: 65秒待機中...")
                    time.sleep(65)

                self.sheets_service.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={'requests': batch_requests}
                ).execute()

                deleted_count += len(batch_requests)
                logger.info(f"削除進捗: {deleted_count}/{len(requests)}")

            logger.info(f"✅ {deleted_count}行を削除しました")
            return deleted_count

        except Exception as e:
            logger.error(f"削除エラー: {e}")
            return 0

    def _get_sheet_id(self, sheet_name: str) -> int:
        """シート名からシートIDを取得（キャッシュ使用）"""
        # キャッシュから取得
        if sheet_name in self._sheet_id_cache:
            return self._sheet_id_cache[sheet_name]

        try:
            spreadsheet = self.sheets_service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()

            for sheet in spreadsheet.get('sheets', []):
                if sheet['properties']['title'] == sheet_name:
                    sheet_id = sheet['properties']['sheetId']
                    # キャッシュに保存
                    self._sheet_id_cache[sheet_name] = sheet_id
                    return sheet_id

            raise ValueError(f"シートが見つかりません: {sheet_name}")

        except Exception as e:
            logger.error(f"シートID取得エラー: {e}")
            raise


def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description='Vector DB Spreadsheetのクリーンアップ')
    parser.add_argument('--dry-run', action='store_true', help='実行内容を表示のみ（実際には削除しない）')
    parser.add_argument('--fix-header', action='store_true', help='Embeddingsシートのヘッダーのみ修正')
    args = parser.parse_args()

    try:
        cleaner = VectorDBCleaner()

        logger.info("============================================================")
        logger.info("Vector DB Spreadsheet クリーンアップ")
        logger.info("============================================================")
        logger.info(f"Spreadsheet ID: {VECTOR_DB_SPREADSHEET_ID}")
        logger.info(f"Dry Run: {args.dry_run}")
        logger.info("============================================================\n")

        # 1. Embeddingsヘッダー更新
        if args.fix_header or not args.dry_run:
            cleaner.update_embeddings_header()
            logger.info("")

        # 2. KnowledgeBase統計情報
        stats = cleaner.get_knowledgebase_stats()
        logger.info("")

        # 3. Embeddingがない行を削除
        if not args.fix_header:
            deleted = cleaner.delete_rows_without_embedding(dry_run=args.dry_run)
            logger.info("")

        logger.info("============================================================")
        logger.info("完了")
        logger.info("============================================================")

    except Exception as e:
        logger.error(f"エラー: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
