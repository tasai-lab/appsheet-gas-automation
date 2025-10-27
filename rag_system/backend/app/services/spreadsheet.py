"""
Google Spreadsheet サービス

Vector DBとして使用するGoogle Spreadsheetへのアクセスを提供します。
"""

import logging
from typing import List, Dict, Any, Optional
import json

from google.auth import default
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SpreadsheetClient:
    """Google Spreadsheet クライアント"""

    def __init__(self):
        """初期化"""
        # Google Cloud認証
        credentials, project = default()

        # Sheets API クライアント
        self.service = build('sheets', 'v4', credentials=credentials)

        self.spreadsheet_id = settings.vector_db_spreadsheet_id
        self.sheets = settings.vector_db_sheets

        if not self.spreadsheet_id:
            logger.warning("Vector DB Spreadsheet ID not configured")
        else:
            logger.info(
                f"Spreadsheet client initialized - ID: {self.spreadsheet_id}"
            )

    def read_sheet(
        self,
        sheet_name: str,
        range_notation: Optional[str] = None
    ) -> List[List[Any]]:
        """
        シートからデータを読み込み

        Args:
            sheet_name: シート名
            range_notation: 範囲指定（例: "A1:Z1000"、Noneの場合は全データ）

        Returns:
            シートデータ（2次元リスト）

        Raises:
            HttpError: Sheets API呼び出しエラー
        """
        try:
            # 範囲を構築
            if range_notation:
                range_str = f"{sheet_name}!{range_notation}"
            else:
                range_str = sheet_name

            # データ取得
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_str
            ).execute()

            values = result.get('values', [])
            logger.debug(f"Read {len(values)} rows from {sheet_name}")

            return values

        except HttpError as e:
            logger.error(f"Failed to read sheet {sheet_name}: {e}", exc_info=True)
            raise

    def read_knowledge_base(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        KnowledgeBaseシートを読み込み

        Args:
            limit: 取得する最大行数（Noneの場合は全データ）

        Returns:
            ナレッジベースのレコードリスト
        """
        sheet_name = self.sheets['knowledge_base']
        values = self.read_sheet(sheet_name)

        if not values:
            logger.warning(f"No data in {sheet_name}")
            return []

        # ヘッダー行を取得
        headers = values[0]
        records = []

        # データ行を辞書に変換
        for row in values[1:limit+1 if limit else None]:
            # 行の長さがヘッダーより短い場合は空文字で埋める
            padded_row = row + [''] * (len(headers) - len(row))

            record = dict(zip(headers, padded_row))

            # structured_data と metadata をJSONパース
            if record.get('structured_data'):
                try:
                    record['structured_data'] = json.loads(record['structured_data'])
                except json.JSONDecodeError:
                    pass

            if record.get('metadata'):
                try:
                    record['metadata'] = json.loads(record['metadata'])
                except json.JSONDecodeError:
                    pass

            records.append(record)

        logger.info(f"Loaded {len(records)} records from KnowledgeBase")
        return records

    def read_embeddings(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Embeddingsシートを読み込み

        3分割されたembedding（embedding_part1, embedding_part2, embedding_part3）を統合します。

        Args:
            limit: 取得する最大行数（Noneの場合は全データ）

        Returns:
            Embeddingsレコードリスト（統合されたembeddingを含む）
        """
        sheet_name = self.sheets['embeddings']
        values = self.read_sheet(sheet_name)

        if not values:
            logger.warning(f"No data in {sheet_name}")
            return []

        headers = values[0]
        records = []

        for row in values[1:limit+1 if limit else None]:
            padded_row = row + [''] * (len(headers) - len(row))
            record = dict(zip(headers, padded_row))

            # 3分割されたembeddingベクトルを統合
            try:
                part1 = json.loads(record.get('embedding_part1', '[]'))
                part2 = json.loads(record.get('embedding_part2', '[]'))
                part3 = json.loads(record.get('embedding_part3', '[]'))

                # 3つのパートを結合して完全なベクトルを作成
                record['embedding'] = part1 + part2 + part3

                if not record['embedding']:
                    logger.warning(f"Empty embedding for kb_id: {record.get('kb_id')}")

            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse embedding parts for kb_id: {record.get('kb_id')} - {e}")
                record['embedding'] = []

            records.append(record)

        logger.info(f"Loaded {len(records)} embeddings")
        return records

    def read_medical_terms(self) -> List[Dict[str, Any]]:
        """
        MedicalTermsシートを読み込み

        Returns:
            医療用語辞書のレコードリスト
        """
        sheet_name = self.sheets['medical_terms']
        values = self.read_sheet(sheet_name)

        if not values:
            logger.warning(f"No data in {sheet_name}")
            return []

        headers = values[0]
        records = []

        for row in values[1:]:
            padded_row = row + [''] * (len(headers) - len(row))
            record = dict(zip(headers, padded_row))

            # synonyms をJSONパース
            if record.get('synonyms'):
                try:
                    record['synonyms'] = json.loads(record['synonyms'])
                except json.JSONDecodeError:
                    # 文字列のまま保持
                    pass

            records.append(record)

        logger.info(f"Loaded {len(records)} medical terms")
        return records

    def write_sheet(
        self,
        sheet_name: str,
        values: List[List[Any]],
        range_notation: str = "A1"
    ):
        """
        シートにデータを書き込み

        Args:
            sheet_name: シート名
            values: 書き込むデータ（2次元リスト）
            range_notation: 開始セル（例: "A1"）

        Raises:
            HttpError: Sheets API呼び出しエラー
        """
        try:
            range_str = f"{sheet_name}!{range_notation}"

            body = {'values': values}
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_str,
                valueInputOption='RAW',
                body=body
            ).execute()

            logger.info(f"Updated {result.get('updatedCells', 0)} cells in {sheet_name}")

        except HttpError as e:
            logger.error(f"Failed to write to sheet {sheet_name}: {e}", exc_info=True)
            raise

    def append_to_sheet(
        self,
        sheet_name: str,
        values: List[List[Any]]
    ):
        """
        シートにデータを追記

        Args:
            sheet_name: シート名
            values: 追記するデータ（2次元リスト）

        Raises:
            HttpError: Sheets API呼び出しエラー
        """
        try:
            body = {'values': values}
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=sheet_name,
                valueInputOption='RAW',
                body=body
            ).execute()

            logger.info(f"Appended {len(values)} rows to {sheet_name}")

        except HttpError as e:
            logger.error(f"Failed to append to sheet {sheet_name}: {e}", exc_info=True)
            raise


# モジュールレベルのシングルトン
_spreadsheet_client: Optional[SpreadsheetClient] = None


def get_spreadsheet_client() -> SpreadsheetClient:
    """
    Spreadsheetクライアントを取得（シングルトン）

    Returns:
        SpreadsheetClient: Spreadsheetクライアント
    """
    global _spreadsheet_client
    if _spreadsheet_client is None:
        _spreadsheet_client = SpreadsheetClient()
    return _spreadsheet_client
