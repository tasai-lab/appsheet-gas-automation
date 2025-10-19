#!/usr/bin/env python3
"""
実行ログスプレッドシートのヘッダーを直接更新
"""

import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from googleapiclient.discovery import build
from src.services import AuthService
from src import config

# スプレッドシート書き込み用のスコープを追加
SCOPES = list(config.SCOPES) + [
    'https://www.googleapis.com/auth/spreadsheets'  # 書き込み権限
]

LOG_FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
LOG_SPREADSHEET_NAME = 'GAS実行ログ_統合'

def setup_logging():
    """Setup logging."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(message)s'
    )
    logging.getLogger('googleapiclient.discovery_cache').setLevel(logging.ERROR)

def find_spreadsheet(drive_service):
    """スプレッドシートを検索"""
    print("📁 スプレッドシート検索中...")
    query = f"name='{LOG_SPREADSHEET_NAME}' and '{LOG_FOLDER_ID}' in parents and trashed=false"
    results = drive_service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name, webViewLink)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    files = results.get('files', [])
    if not files:
        raise Exception(f"スプレッドシートが見つかりません: {LOG_SPREADSHEET_NAME}")

    file_info = files[0]
    print(f"✓ スプレッドシート取得成功")
    print(f"  名前: {file_info['name']}")
    print(f"  URL: {file_info['webViewLink']}")
    return file_info['id'], file_info['webViewLink']

def update_headers(sheets_service, spreadsheet_id, spreadsheet_url):
    """ヘッダー行を直接更新"""
    print()
    print("📝 ヘッダー更新中...")

    # 新しいヘッダー（完全版）
    new_headers = [
        '開始時刻',
        '終了時刻',
        '実行時間(秒)',
        'スクリプト名',
        'ステータス',
        'レコードID',
        'リクエストID',
        'ログサマリー',
        'エラー詳細',
        'モデル',
        'Input Tokens',
        'Output Tokens',
        'Input料金(円)',
        'Output料金(円)',
        '合計料金(円)'
    ]

    # シート情報を取得
    spreadsheet = sheets_service.spreadsheets().get(
        spreadsheetId=spreadsheet_id
    ).execute()

    # 「実行ログ」シートを探す
    sheet_id = None
    for sheet in spreadsheet['sheets']:
        if sheet['properties']['title'] == '実行ログ':
            sheet_id = sheet['properties']['sheetId']
            break

    if sheet_id is None:
        raise Exception("「実行ログ」シートが見つかりません")

    # 現在のヘッダーを取得
    current_data = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range='実行ログ!1:1'
    ).execute()

    current_headers = current_data.get('values', [[]])[0] if current_data.get('values') else []
    print(f"  現在のカラム数: {len(current_headers)}")

    # バッチ更新リクエストを準備
    requests = []

    # 1. ヘッダー行を更新
    requests.append({
        'updateCells': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 1,
                'startColumnIndex': 0,
                'endColumnIndex': len(new_headers)
            },
            'rows': [{
                'values': [
                    {
                        'userEnteredValue': {'stringValue': header},
                        'userEnteredFormat': {
                            'backgroundColor': {
                                'red': 0.259,
                                'green': 0.522,
                                'blue': 0.957
                            },
                            'textFormat': {
                                'foregroundColor': {'red': 1, 'green': 1, 'blue': 1},
                                'bold': True
                            }
                        }
                    }
                    for header in new_headers
                ]
            }],
            'fields': 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat)'
        }
    })

    # 2. 列幅を設定
    column_widths = {
        0: 150,   # 開始時刻
        1: 150,   # 終了時刻
        2: 100,   # 実行時間
        3: 250,   # スクリプト名
        4: 100,   # ステータス
        5: 150,   # レコードID
        6: 250,   # リクエストID
        7: 400,   # ログサマリー
        8: 400,   # エラー詳細
        9: 180,   # モデル
        10: 120,  # Input Tokens
        11: 120,  # Output Tokens
        12: 120,  # Input料金(円)
        13: 120,  # Output料金(円)
        14: 120   # 合計料金(円)
    }

    for col_index, width in column_widths.items():
        requests.append({
            'updateDimensionProperties': {
                'range': {
                    'sheetId': sheet_id,
                    'dimension': 'COLUMNS',
                    'startIndex': col_index,
                    'endIndex': col_index + 1
                },
                'properties': {
                    'pixelSize': width
                },
                'fields': 'pixelSize'
            }
        })

    # バッチ更新を実行
    body = {'requests': requests}
    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()

    print(f"✓ ヘッダー更新完了")
    print(f"  更新後のカラム数: {len(new_headers)}")
    print()
    print("📋 新しいヘッダー:")
    for i, header in enumerate(new_headers, 1):
        marker = "🆕" if i > len(current_headers) else "  "
        print(f"  {marker} {i:2d}. {header}")

    return spreadsheet_url

def main():
    """メイン処理"""
    setup_logging()

    print("=" * 70)
    print("  実行ログスプレッドシート ヘッダー更新")
    print("=" * 70)
    print()

    try:
        # 認証
        print("🔐 認証中...")
        auth_service = AuthService(
            credentials_file=config.CREDENTIALS_FILE,
            token_file=config.TOKEN_FILE,
            scopes=SCOPES,
            project_id=config.PROJECT_ID
        )
        creds = auth_service.get_credentials()
        print("✓ 認証成功")
        print()

        # サービス初期化
        drive_service = build('drive', 'v3', credentials=creds)
        sheets_service = build('sheets', 'v4', credentials=creds)

        # スプレッドシート検索
        spreadsheet_id, spreadsheet_url = find_spreadsheet(drive_service)

        # ヘッダー更新
        spreadsheet_url = update_headers(sheets_service, spreadsheet_id, spreadsheet_url)

        print()
        print("=" * 70)
        print("✅ 完了しました！")
        print("=" * 70)
        print()
        print(f"スプレッドシートURL:")
        print(f"  {spreadsheet_url}")
        print()

        return 0

    except Exception as e:
        print()
        print("=" * 70)
        print(f"❌ エラー: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
