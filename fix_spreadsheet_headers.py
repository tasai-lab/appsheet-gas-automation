#!/usr/bin/env python3
"""
実行ログスプレッドシートのヘッダーを直接更新
"""

import pickle
import os.path
from googleapiclient.discovery import build

# 既存のトークンを使用
TOKEN_FILE = '/Users/t.asai/code/nursing_record_gas/token.pickle'

# スプレッドシート設定
SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA'
SHEET_NAME = '実行ログ'

def get_credentials():
    """既存の認証情報を取得"""
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(f"トークンファイルが見つかりません: {TOKEN_FILE}")

    with open(TOKEN_FILE, 'rb') as token:
        creds = pickle.load(token)

    return creds

def update_spreadsheet_headers():
    """スプレッドシートのヘッダーを更新"""
    print("=" * 70)
    print("  実行ログスプレッドシート ヘッダー更新")
    print("=" * 70)
    print()

    # 新しいヘッダー
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

    print("🔐 認証中...")
    creds = get_credentials()

    print("✓ 認証成功")
    print()

    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()

    # シート情報を取得
    print("📋 シート情報取得中...")
    spreadsheet = sheet.get(spreadsheetId=SPREADSHEET_ID).execute()

    # シート一覧を表示
    print("利用可能なシート:")
    for s in spreadsheet['sheets']:
        print(f"  - {s['properties']['title']} (ID: {s['properties']['sheetId']})")
    print()

    # 最初のシートを使用
    sheet_id = spreadsheet['sheets'][0]['properties']['sheetId']
    actual_sheet_name = spreadsheet['sheets'][0]['properties']['title']
    print(f"使用するシート: {actual_sheet_name} (ID: {sheet_id})")
    print()

    print("📝 現在のヘッダー取得中...")
    # 現在のヘッダーを取得（シート名をクォート）
    result = sheet.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{actual_sheet_name}'!1:1"
    ).execute()

    current_headers = result.get('values', [[]])[0] if result.get('values') else []
    print(f"  現在のカラム数: {len(current_headers)}")
    print()

    # バッチ更新リクエスト
    print("🔄 ヘッダー更新中...")
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
                            },
                            'horizontalAlignment': 'CENTER'
                        }
                    }
                    for header in new_headers
                ]
            }],
            'fields': 'userEnteredValue,userEnteredFormat'
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
    sheet.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=body
    ).execute()

    print("✓ ヘッダー更新完了")
    print()

    # 結果表示
    print("📋 新しいヘッダー:")
    for i, header in enumerate(new_headers, 1):
        marker = "🆕" if i > len(current_headers) else "  "
        print(f"  {marker} {i:2d}. {header}")

    print()
    print("=" * 70)
    print("✅ 完了しました！")
    print("=" * 70)
    print()
    print(f"スプレッドシートURL:")
    print(f"  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
    print()

    return True

if __name__ == '__main__':
    try:
        success = update_spreadsheet_headers()
        exit(0 if success else 1)
    except Exception as e:
        print()
        print("=" * 70)
        print(f"❌ エラー: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        exit(1)
