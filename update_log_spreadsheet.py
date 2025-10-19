#!/usr/bin/env python3
"""
実行ログスプレッドシートのヘッダーを更新
API使用量とコスト情報のカラムを追加
"""

import os
import pickle
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# 設定
LOG_FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
LOG_SPREADSHEET_NAME = 'GAS実行ログ_統合'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly']

def get_credentials():
    """認証情報を取得"""
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return creds

def find_spreadsheet(drive_service):
    """スプレッドシートを検索"""
    query = f"name='{LOG_SPREADSHEET_NAME}' and '{LOG_FOLDER_ID}' in parents and trashed=false"
    results = drive_service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    files = results.get('files', [])
    if not files:
        raise Exception(f"スプレッドシートが見つかりません: {LOG_SPREADSHEET_NAME}")

    return files[0]['id']

def update_headers(sheets_service, spreadsheet_id):
    """ヘッダー行を更新"""

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

    print(f"✓ スプレッドシート取得成功")
    print(f"  URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")

    # 現在のヘッダーを取得
    current_data = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range='実行ログ!1:1'
    ).execute()

    current_headers = current_data.get('values', [[]])[0] if current_data.get('values') else []
    print(f"✓ 現在のカラム数: {len(current_headers)}")

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
                            'backgroundColor': {'red': 0.259, 'green': 0.522, 'blue': 0.957},  # #4285f4
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

    # 2. 新しいカラムの列幅を設定
    column_widths = {
        9: 180,   # モデル (J列)
        10: 120,  # Input Tokens (K列)
        11: 120,  # Output Tokens (L列)
        12: 120,  # Input料金(円) (M列)
        13: 120,  # Output料金(円) (N列)
        14: 120   # 合計料金(円) (O列)
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
    print(f"✓ 更新後のカラム数: {len(new_headers)}")
    print(f"\n新しいヘッダー:")
    for i, header in enumerate(new_headers, 1):
        print(f"  {i:2d}. {header}")

def main():
    """メイン処理"""
    print("=" * 60)
    print("実行ログスプレッドシートのヘッダー更新")
    print("=" * 60)
    print()

    try:
        # 認証
        print("認証中...")
        creds = get_credentials()

        # サービス初期化
        drive_service = build('drive', 'v3', credentials=creds)
        sheets_service = build('sheets', 'v4', credentials=creds)

        # スプレッドシート検索
        print("スプレッドシート検索中...")
        spreadsheet_id = find_spreadsheet(drive_service)

        # ヘッダー更新
        print("ヘッダー更新中...")
        update_headers(sheets_service, spreadsheet_id)

        print()
        print("=" * 60)
        print("✓ 完了しました！")
        print("=" * 60)

    except Exception as e:
        print()
        print("=" * 60)
        print(f"✗ エラー: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == '__main__':
    exit(main())
