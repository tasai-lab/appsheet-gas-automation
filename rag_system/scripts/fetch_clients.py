#!/usr/bin/env python3
"""
利用者情報取得スクリプト

機能:
1. Clientsシートから利用者一覧を取得
2. 利用者ID、名前、その他基本情報を取得
3. Backend API用のJSONファイルとして保存
"""

import os
import sys
import json
import logging
from typing import List, Dict, Any
from pathlib import Path

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
CLIENTS_SPREADSHEET_ID = "1S3Gsxu9kEa4M9uZpWuIRLvPVjpCOoj2lo7GhSIA5I0I"
CLIENTS_SHEET_NAME = "Clients"
OUTPUT_FILE = Path(__file__).parent.parent / "backend" / "data" / "clients.json"

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
]


class ClientsFetcher:
    """利用者情報取得クラス"""

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

    def fetch_clients(self) -> List[Dict[str, Any]]:
        """利用者情報を取得"""
        logger.info(f"=== 利用者情報取得 ===")
        logger.info(f"Spreadsheet ID: {CLIENTS_SPREADSHEET_ID}")
        logger.info(f"Sheet Name: {CLIENTS_SHEET_NAME}")

        try:
            # シート全体を取得
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=CLIENTS_SPREADSHEET_ID,
                range=f"{CLIENTS_SHEET_NAME}!A:Z"
            ).execute()

            values = result.get('values', [])

            if not values:
                logger.warning("データが見つかりません")
                return []

            # ヘッダー行
            header = values[0]
            logger.info(f"カラム数: {len(header)}")
            logger.info(f"ヘッダー: {header}")

            # データ行
            clients = []
            for idx, row in enumerate(values[1:], start=2):
                if not row:
                    continue

                # 行をディクショナリに変換
                client = {}
                for col_idx, col_name in enumerate(header):
                    if col_idx < len(row):
                        client[col_name] = row[col_idx]
                    else:
                        client[col_name] = ""

                clients.append(client)

            logger.info(f"✅ {len(clients)}件の利用者情報を取得しました")

            # サンプル表示（最初の3件）
            logger.info(f"\n--- サンプルデータ（最初の3件） ---")
            for client in clients[:3]:
                logger.info(json.dumps(client, ensure_ascii=False, indent=2))

            return clients

        except Exception as e:
            logger.error(f"データ取得エラー: {e}")
            raise

    def save_clients(self, clients: List[Dict[str, Any]]) -> None:
        """利用者情報をJSONファイルに保存"""
        logger.info(f"=== 利用者情報保存 ===")
        logger.info(f"保存先: {OUTPUT_FILE}")

        try:
            # ディレクトリ作成
            OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

            # JSONファイルに保存
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(clients, f, ensure_ascii=False, indent=2)

            logger.info(f"✅ {len(clients)}件の利用者情報を保存しました")

        except Exception as e:
            logger.error(f"保存エラー: {e}")
            raise

    def extract_client_list(self, clients: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """利用者一覧（ID + 名前 + カタカナ名）を抽出"""
        # 必要なフィールドを特定
        id_candidates = ['client_id', 'id', 'key', 'ID', 'Key', '利用者ID']
        name_candidates = ['full_name', 'name', 'Name', 'client_name', '氏名', '名前', 'フルネーム']
        kana_candidates = ['full_name_kana', 'name_kana', 'kana', 'フリガナ', 'カナ', 'よみがな']

        # 最初のクライアントからフィールドを判定
        if not clients:
            return []

        first_client = clients[0]

        # IDフィールドを特定
        id_field = None
        for candidate in id_candidates:
            if candidate in first_client:
                id_field = candidate
                break

        # 名前フィールドを特定
        name_field = None
        for candidate in name_candidates:
            if candidate in first_client:
                name_field = candidate
                break

        # カタカナ名フィールドを特定
        kana_field = None
        for candidate in kana_candidates:
            if candidate in first_client:
                kana_field = candidate
                break

        if not id_field or not name_field:
            logger.warning(f"IDまたは名前フィールドが見つかりません")
            logger.warning(f"利用可能なフィールド: {list(first_client.keys())}")
            return []

        logger.info(f"IDフィールド: {id_field}")
        logger.info(f"名前フィールド: {name_field}")
        logger.info(f"カタカナ名フィールド: {kana_field or '(なし)'}")

        # 利用者一覧を抽出
        client_list = []
        for client in clients:
            client_id = client.get(id_field, "")
            client_name = client.get(name_field, "")
            client_kana = client.get(kana_field, "") if kana_field else ""

            if client_id and client_name:
                client_list.append({
                    "id": client_id,
                    "name": client_name,
                    "name_kana": client_kana
                })

        # カタカナ名昇順でソート
        client_list.sort(key=lambda x: x.get('name_kana', x.get('name', '')))

        logger.info(f"✅ {len(client_list)}件の利用者一覧を抽出しました（カタカナ昇順）")

        return client_list


def main():
    """メイン処理"""
    try:
        logger.info("============================================================")
        logger.info("利用者情報取得")
        logger.info("============================================================\n")

        fetcher = ClientsFetcher()

        # 1. 利用者情報取得
        clients = fetcher.fetch_clients()

        if not clients:
            logger.warning("利用者情報が見つかりませんでした")
            sys.exit(1)

        # 2. 利用者情報保存
        fetcher.save_clients(clients)

        # 3. 利用者一覧抽出
        client_list = fetcher.extract_client_list(clients)

        # 利用者一覧を別ファイルに保存
        client_list_file = Path(__file__).parent.parent / "backend" / "data" / "client_list.json"
        with open(client_list_file, 'w', encoding='utf-8') as f:
            json.dump(client_list, f, ensure_ascii=False, indent=2)

        logger.info(f"\n利用者一覧を保存: {client_list_file}")

        # サンプル表示
        logger.info(f"\n--- 利用者一覧（最初の10件・カタカナ昇順） ---")
        for client in client_list[:10]:
            name_kana = client.get('name_kana', '')
            display = f"{client['name']}（{name_kana}）" if name_kana else client['name']
            logger.info(f"  {client['id']}: {display}")

        if len(client_list) > 10:
            logger.info(f"  ... 他 {len(client_list) - 10} 件")

        logger.info("\n============================================================")
        logger.info("完了")
        logger.info("============================================================")

    except Exception as e:
        logger.error(f"エラー: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
