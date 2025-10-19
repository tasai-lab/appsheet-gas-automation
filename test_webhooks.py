#!/usr/bin/env python3
"""
各プロジェクトのWebhookをテストして実行ログを確認
"""

import pickle
import os.path
import requests
import json
import time
from googleapiclient.discovery import build
from datetime import datetime

# 認証設定
TOKEN_FILE = '/Users/t.asai/code/nursing_record_gas/token.pickle'
SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA'
SHEET_NAME = '実行履歴'

# Webhook URL
WEBHOOKS = {
    '通話_質疑応答': {
        'url': 'https://script.google.com/macros/s/AKfycbwcpfSWRvkbdCvkO3ku-bZ9cJiJqukAFtOXkOvBcjdFNikEnn8ivyTajbAUcdjXuF6SUg/exec',
        'payload': {
            'queryId': f'test_query_{int(time.time())}',
            'promptText': 'この通話の要点を3つ挙げてください',
            'callSummary': 'テスト通話の要約です。顧客からの問い合わせに対応しました。',
            'callTranscript': '顧客: こんにちは。\n担当者: お世話になっております。',
            'call_info': '通話時間: 5分',
            'modelKeyword': '標準'
        }
    }
}

def get_credentials():
    """認証情報を取得"""
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(f"トークンファイルが見つかりません: {TOKEN_FILE}")

    with open(TOKEN_FILE, 'rb') as token:
        creds = pickle.load(token)

    return creds

def get_latest_logs(sheets_service, limit=5):
    """最新のログを取得"""
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{SHEET_NAME}'!A2:O100"  # 最大100行取得
    ).execute()

    values = result.get('values', [])

    if not values:
        return []

    # 最新のlimit件を取得
    return values[-limit:] if len(values) >= limit else values

def print_log_entry(entry, index):
    """ログエントリーを表示"""
    if len(entry) < 15:
        # 15列に満たない場合は空文字で埋める
        entry = entry + [''] * (15 - len(entry))

    print(f"\n--- ログ #{index} ---")
    print(f"  開始時刻: {entry[0]}")
    print(f"  実行時間: {entry[2]}秒")
    print(f"  スクリプト名: {entry[3]}")
    print(f"  ステータス: {entry[4]}")
    print(f"  レコードID: {entry[5]}")
    print(f"  モデル: {entry[9]}")
    print(f"  Input Tokens: {entry[10]}")
    print(f"  Output Tokens: {entry[11]}")
    print(f"  Input料金(円): {entry[12]}")
    print(f"  Output料金(円): {entry[13]}")
    print(f"  合計料金(円): {entry[14]}")

def test_webhook(name, config):
    """Webhookをテスト"""
    print(f"\n{'='*70}")
    print(f"  {name} Webhookテスト")
    print(f"{'='*70}")

    url = config['url']
    payload = config['payload']

    print(f"\nWebhook URL: {url}")
    print(f"\nペイロード:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"\n🔄 Webhook実行中...")

    try:
        response = requests.post(
            url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=300  # 5分タイムアウト
        )

        print(f"✓ レスポンス受信")
        print(f"  ステータスコード: {response.status_code}")
        print(f"  レスポンス: {response.text}")

        return response.status_code == 200

    except requests.exceptions.Timeout:
        print(f"⚠ タイムアウト（5分超過）")
        return False
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def main():
    """メイン処理"""
    print("="*70)
    print("  Webhookテストと実行ログ検証")
    print("="*70)

    # 認証
    print("\n🔐 認証中...")
    creds = get_credentials()
    sheets_service = build('sheets', 'v4', credentials=creds)
    print("✓ 認証成功")

    # テスト前のログ確認
    print("\n📋 テスト前のログ（最新5件）:")
    before_logs = get_latest_logs(sheets_service, 5)
    for i, entry in enumerate(before_logs, 1):
        print_log_entry(entry, i)

    # Webhookテスト実行
    for name, config in WEBHOOKS.items():
        success = test_webhook(name, config)

        if success:
            print(f"\n⏳ ログ反映を待機中（10秒）...")
            time.sleep(10)

    # テスト後のログ確認
    print("\n" + "="*70)
    print("  テスト後のログ確認")
    print("="*70)

    after_logs = get_latest_logs(sheets_service, 10)

    print(f"\n📋 テスト後のログ（最新10件）:")
    for i, entry in enumerate(after_logs, 1):
        print_log_entry(entry, i)

    # 新しいログを検出
    new_logs = after_logs[len(before_logs):]

    if new_logs:
        print(f"\n" + "="*70)
        print(f"  新規ログ検出: {len(new_logs)}件")
        print("="*70)

        for i, entry in enumerate(new_logs, 1):
            print_log_entry(entry, i)

            # API使用量の検証
            if len(entry) >= 15:
                has_model = entry[9] and entry[9].strip() != ''
                has_tokens = entry[10] and entry[10].strip() != ''
                has_cost = entry[14] and entry[14].strip() != ''

                if has_model and has_tokens and has_cost:
                    print(f"\n  ✅ API使用量情報が正しく記録されています")
                else:
                    print(f"\n  ⚠️  API使用量情報が不完全です")
                    print(f"     モデル: {'○' if has_model else '×'}")
                    print(f"     トークン: {'○' if has_tokens else '×'}")
                    print(f"     料金: {'○' if has_cost else '×'}")
    else:
        print(f"\n⚠️  新しいログが検出されませんでした")
        print(f"   Webhook実行が失敗した可能性があります")

    print(f"\n" + "="*70)
    print(f"✅ テスト完了")
    print(f"="*70)
    print(f"\nスプレッドシートURL:")
    print(f"  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")

if __name__ == '__main__':
    main()
