#!/usr/bin/env python3
"""
孤立したEmbeddings削除スクリプト
KnowledgeBaseに存在しないkb_idを持つEmbeddingsを削除
"""

import os
import sys
import argparse
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


def cleanup_orphaned_embeddings(force: bool = False):
    """KnowledgeBaseに存在しないkb_idを持つEmbeddingsを削除"""

    print(f"\n{'='*60}")
    print("孤立したEmbeddings削除処理")
    print(f"{'='*60}")
    print(f"Vector DB: {VECTOR_DB_SPREADSHEET_ID}")
    print(f"Force Mode: {'有効' if force else '無効（確認あり）'}")
    print(f"{'='*60}\n")

    # 認証
    credentials, project = google.auth.default(
        scopes=[
            'https://www.googleapis.com/auth/spreadsheets',
        ]
    )

    service = build('sheets', 'v4', credentials=credentials)

    # 1. KnowledgeBaseから有効なkb_idを取得
    print("📖 KnowledgeBaseから有効なkb_idを読み込み中...")
    kb_result = service.spreadsheets().values().get(
        spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
        range="KnowledgeBase!A:A"
    ).execute()

    kb_values = kb_result.get('values', [])
    if not kb_values or len(kb_values) < 2:
        print("⚠️ KnowledgeBaseにデータがありません")
        return

    # ヘッダー除外して有効なkb_idセットを作成
    valid_kb_ids = set()
    for row in kb_values[1:]:
        if row and row[0]:
            valid_kb_ids.add(row[0])

    print(f"✅ KnowledgeBaseに{len(valid_kb_ids)}件の有効なkb_idを確認")

    # 2. Embeddingsから全kb_idを取得
    print("\n📊 Embeddingsから全kb_idを読み込み中...")
    emb_result = service.spreadsheets().values().get(
        spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
        range="Embeddings!A:A"
    ).execute()

    emb_values = emb_result.get('values', [])
    if not emb_values or len(emb_values) < 2:
        print("⚠️ Embeddingsにデータがありません")
        return

    # 3. 孤立したEmbeddingsを特定
    rows_to_delete = []
    total_embeddings = len(emb_values) - 1  # ヘッダー除く

    for i, row in enumerate(emb_values[1:], start=2):  # 行番号は2から開始
        if not row or not row[0]:
            # kb_idが空の行
            rows_to_delete.append(i)
        elif row[0] not in valid_kb_ids:
            # KnowledgeBaseに存在しないkb_id
            rows_to_delete.append(i)

    orphaned_count = len(rows_to_delete)
    valid_count = total_embeddings - orphaned_count

    print(f"\n📊 統計情報:")
    print(f"  - 総Embeddingsレコード数: {total_embeddings}")
    print(f"  - 孤立したEmbeddings: {orphaned_count} ({orphaned_count/total_embeddings*100:.1f}%)")
    print(f"  - 有効なEmbeddings: {valid_count} ({valid_count/total_embeddings*100:.1f}%)")

    if orphaned_count == 0:
        print("\n✅ 孤立したEmbeddingsはありません")
        return

    # 削除確認
    if not force:
        user_input = input(f"\n⚠️ Embeddingsから{orphaned_count}件削除しますか？ (yes/no): ")
        if user_input.lower() != 'yes':
            print("❌ 削除をキャンセルしました")
            return
    else:
        print(f"\n⚠️ Force Mode: {orphaned_count}件を自動削除します")

    # 4. 行を削除（後ろから削除して行番号がズレないように）
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
                    "sheetId": get_sheet_id(service, VECTOR_DB_SPREADSHEET_ID, "Embeddings"),
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

        print(f"✅ {orphaned_count}件の孤立したEmbeddingsを削除完了")

    print(f"\n📊 最終結果:")
    print(f"  - KnowledgeBase: {len(valid_kb_ids)}件")
    print(f"  - Embeddings: {valid_count}件（孤立分削除後）")
    print(f"  - データの整合性: {'✅ 正常' if len(valid_kb_ids) == valid_count else '⚠️ 不一致'}")

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
    parser = argparse.ArgumentParser(
        description="孤立したEmbeddingsを削除（KnowledgeBaseに存在しないkb_id）"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='確認なしで自動削除（デフォルト: 確認あり）'
    )
    args = parser.parse_args()

    try:
        cleanup_orphaned_embeddings(force=args.force)
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
