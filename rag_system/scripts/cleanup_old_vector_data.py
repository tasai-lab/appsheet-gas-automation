#!/usr/bin/env python3
"""
古いベクトルデータ削除スクリプト
source_idが空のレコードを削除してAPI実行数を節約
"""

import os
import sys
from pathlib import Path

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import google.auth
from googleapiclient.discovery import build
from dotenv import load_dotenv

# .env読み込み
env_path = project_root / 'backend' / '.env'
load_dotenv(env_path)

VECTOR_DB_SPREADSHEET_ID = os.getenv("VECTOR_DB_SPREADSHEET_ID")

def cleanup_old_data():
    """source_idが空の古いデータを削除"""

    print(f"\n{'='*60}")
    print("古いベクトルデータ削除処理")
    print(f"{'='*60}")
    print(f"Vector DB: {VECTOR_DB_SPREADSHEET_ID}")
    print(f"{'='*60}\n")

    # 認証
    credentials, project = google.auth.default(
        scopes=[
            'https://www.googleapis.com/auth/spreadsheets',
        ]
    )

    service = build('sheets', 'v4', credentials=credentials)

    # 各シートから古いデータを削除
    sheets_to_clean = ['KnowledgeBase', 'Embeddings']

    for sheet_name in sheets_to_clean:
        print(f"\n{'='*60}")
        print(f"処理中: {sheet_name}")
        print(f"{'='*60}")

        # データ読み込み
        result = service.spreadsheets().values().get(
            spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
            range=f"{sheet_name}!A:Z"
        ).execute()

        values = result.get('values', [])
        if not values:
            print(f"⚠️ {sheet_name}にデータがありません")
            continue

        headers = values[0]

        # source_idのカラムインデックスを取得
        try:
            source_id_idx = headers.index('source_id')
        except ValueError:
            print(f"⚠️ {sheet_name}にsource_idカラムが見つかりません")
            continue

        # 削除対象行を特定（source_idが空の行）
        rows_to_delete = []
        total_rows = len(values) - 1  # ヘッダー除く

        for i, row in enumerate(values[1:], start=2):  # 行番号は2から開始
            # 行が短い場合は空と判定
            if len(row) <= source_id_idx or not row[source_id_idx].strip():
                rows_to_delete.append(i)

        old_count = len(rows_to_delete)
        new_count = total_rows - old_count

        print(f"📊 統計情報:")
        print(f"  - 総レコード数: {total_rows}")
        print(f"  - 削除対象（source空）: {old_count} ({old_count/total_rows*100:.1f}%)")
        print(f"  - 保持（source有）: {new_count} ({new_count/total_rows*100:.1f}%)")

        if old_count == 0:
            print("✅ 削除対象なし")
            continue

        # 削除確認
        user_input = input(f"\n⚠️ {sheet_name}から{old_count}件削除しますか？ (yes/no): ")
        if user_input.lower() != 'yes':
            print("❌ スキップしました")
            continue

        # 行を削除（後ろから削除して行番号がズレないように）
        print(f"\n🗑️ 削除中...")
        requests = []

        # バッチで削除（連続する行をまとめて削除）
        i = len(rows_to_delete) - 1
        while i >= 0:
            end_row = rows_to_delete[i]
            start_row = end_row

            # 連続する行を検出
            while i > 0 and rows_to_delete[i-1] == start_row - 1:
                i -= 1
                start_row = rows_to_delete[i]

            # 削除リクエスト追加
            requests.append({
                "deleteDimension": {
                    "range": {
                        "sheetId": get_sheet_id(service, VECTOR_DB_SPREADSHEET_ID, sheet_name),
                        "dimension": "ROWS",
                        "startIndex": start_row - 1,  # 0-indexed
                        "endIndex": end_row
                    }
                }
            })

            i -= 1

        # バッチ実行
        if requests:
            service.spreadsheets().batchUpdate(
                spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
                body={"requests": requests}
            ).execute()

            print(f"✅ {old_count}件削除完了")

    print(f"\n{'='*60}")
    print("✅ クリーンアップ完了")
    print(f"{'='*60}\n")


def get_sheet_id(service, spreadsheet_id: str, sheet_name: str) -> int:
    """シート名からシートIDを取得"""
    spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    for sheet in spreadsheet['sheets']:
        if sheet['properties']['title'] == sheet_name:
            return sheet['properties']['sheetId']
    raise ValueError(f"シート '{sheet_name}' が見つかりません")


if __name__ == "__main__":
    try:
        cleanup_old_data()
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
