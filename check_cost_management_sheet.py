#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GAS実行ログスプレッドシートのコスト管理シート構造を確認するスクリプト
"""
import pickle
from googleapiclient.discovery import build

SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA'

def main():
    # 認証情報を読み込み
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)

    service = build('sheets', 'v4', credentials=creds)

    # スプレッドシートのメタデータを取得
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()

    print("=" * 80)
    print("GAS実行ログスプレッドシート - シート一覧")
    print("=" * 80)

    sheets = spreadsheet.get('sheets', [])
    for sheet in sheets:
        properties = sheet.get('properties', {})
        sheet_name = properties.get('title', '')
        sheet_id = properties.get('sheetId', '')
        row_count = properties.get('gridProperties', {}).get('rowCount', 0)
        col_count = properties.get('gridProperties', {}).get('columnCount', 0)

        print(f"\nシート名: {sheet_name}")
        print(f"  シートID: {sheet_id}")
        print(f"  行数: {row_count}, 列数: {col_count}")

        # ヘッダー行（1行目）を取得
        try:
            range_name = f"'{sheet_name}'!A1:ZZ1"
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name
            ).execute()

            headers = result.get('values', [[]])[0] if result.get('values') else []
            if headers:
                print(f"  ヘッダー ({len(headers)}列):")
                for i, header in enumerate(headers, 1):
                    print(f"    {i}. {header}")
            else:
                print("  ヘッダー: なし")

            # データ行数を確認（ヘッダー以外）
            if row_count > 1:
                data_range = f"'{sheet_name}'!A2:A{row_count}"
                data_result = service.spreadsheets().values().get(
                    spreadsheetId=SPREADSHEET_ID,
                    range=data_range
                ).execute()
                data_rows = len(data_result.get('values', []))
                print(f"  データ行数: {data_rows}")

        except Exception as e:
            print(f"  エラー: {e}")

    print("\n" + "=" * 80)
    print("確認完了")
    print("=" * 80)

if __name__ == '__main__':
    main()
