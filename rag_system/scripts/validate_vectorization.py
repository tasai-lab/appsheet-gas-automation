#!/usr/bin/env python3
"""
ベクトル化検証スクリプト
Phase 4.3x-9 & 4.3x-10: source_id/client_id検証 & データ整合性確認
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

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


def validate_vectorization():
    """ベクトル化の検証を実施"""

    print(f"\n{'='*70}")
    print("Phase 4.3x-9 & 4.3x-10: ベクトル化検証")
    print(f"{'='*70}")
    print(f"Vector DB: {VECTOR_DB_SPREADSHEET_ID}")
    print(f"{'='*70}\n")

    # 認証
    credentials, project = google.auth.default(
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    service = build('sheets', 'v4', credentials=credentials)

    # Phase 4.3x-9: source_id/client_id フィールド検証
    print("\n" + "="*70)
    print("Phase 4.3x-9: source_id/client_id フィールド検証")
    print("="*70)

    kb_result = service.spreadsheets().values().get(
        spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
        range="KnowledgeBase!A:H"
    ).execute()

    kb_values = kb_result.get('values', [])
    if not kb_values:
        print("❌ KnowledgeBaseが空です")
        return

    headers = kb_values[0]
    print(f"📋 カラム: {headers}")

    # source_id と user_id のインデックス取得
    try:
        source_id_idx = headers.index('source_id')
        user_id_idx = headers.index('user_id')
    except ValueError as e:
        print(f"❌ カラムが見つかりません: {e}")
        return

    # 統計情報
    total_records = len(kb_values) - 1
    source_id_empty = 0
    user_id_empty = 0
    both_empty = 0
    both_filled = 0
    source_stats = defaultdict(int)

    for i, row in enumerate(kb_values[1:], start=2):
        source_id = row[source_id_idx] if len(row) > source_id_idx else ""
        user_id = row[user_id_idx] if len(row) > user_id_idx else ""

        if not source_id and not user_id:
            both_empty += 1
        elif not source_id:
            source_id_empty += 1
        elif not user_id:
            user_id_empty += 1
        else:
            both_filled += 1
            # source_idプレフィックスを集計
            prefix = source_id.split('_')[0] if '_' in source_id else source_id
            source_stats[prefix] += 1

    print(f"\n📊 統計情報:")
    print(f"  - 総レコード数: {total_records}")
    print(f"  - source_id & user_id 両方あり: {both_filled} ({both_filled/total_records*100:.1f}%)")
    print(f"  - source_id のみ空: {source_id_empty} ({source_id_empty/total_records*100:.1f}%)")
    print(f"  - user_id のみ空: {user_id_empty} ({user_id_empty/total_records*100:.1f}%)")
    print(f"  - 両方空: {both_empty} ({both_empty/total_records*100:.1f}%)")

    print(f"\n📈 データソース別レコード数:")
    for prefix, count in sorted(source_stats.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {prefix}: {count}件")

    # 検証結果
    if both_filled == total_records:
        print(f"\n✅ Phase 4.3x-9: 全レコードで source_id/user_id が正しく挿入されています")
    elif both_filled / total_records >= 0.95:
        print(f"\n⚠️ Phase 4.3x-9: 95%以上のレコードで正常（{both_filled}/{total_records}）")
    else:
        print(f"\n❌ Phase 4.3x-9: 問題あり - {total_records - both_filled}件で空フィールドあり")

    # Phase 4.3x-10: データ整合性確認
    print("\n" + "="*70)
    print("Phase 4.3x-10: データ整合性確認")
    print("="*70)

    # KnowledgeBase の kb_id セット
    kb_ids = set()
    for row in kb_values[1:]:
        if row and row[0]:
            kb_ids.add(row[0])

    # Embeddings から kb_id 取得
    emb_result = service.spreadsheets().values().get(
        spreadsheetId=VECTOR_DB_SPREADSHEET_ID,
        range="Embeddings!A:A"
    ).execute()

    emb_values = emb_result.get('values', [])
    emb_kb_ids = set()
    for row in emb_values[1:]:
        if row and row[0]:
            emb_kb_ids.add(row[0])

    kb_count = len(kb_ids)
    emb_count = len(emb_kb_ids)

    print(f"\n📊 データ整合性:")
    print(f"  - KnowledgeBase レコード数: {kb_count}")
    print(f"  - Embeddings レコード数: {emb_count}")
    print(f"  - 差分: {abs(kb_count - emb_count)}")

    # kb_id の一致確認
    kb_only = kb_ids - emb_kb_ids
    emb_only = emb_kb_ids - kb_ids

    if kb_only:
        print(f"\n⚠️ KnowledgeBaseのみに存在: {len(kb_only)}件")
        if len(kb_only) <= 5:
            for kb_id in list(kb_only)[:5]:
                print(f"    - {kb_id}")

    if emb_only:
        print(f"\n⚠️ Embeddingsのみに存在: {len(emb_only)}件")
        if len(emb_only) <= 5:
            for kb_id in list(emb_only)[:5]:
                print(f"    - {kb_id}")

    # 検証結果
    if kb_count == emb_count and not kb_only and not emb_only:
        print(f"\n✅ Phase 4.3x-10: データ整合性は完全に正常です")
    elif abs(kb_count - emb_count) <= 5:
        print(f"\n⚠️ Phase 4.3x-10: わずかな差異あり（許容範囲内）")
    else:
        print(f"\n❌ Phase 4.3x-10: データ整合性に問題あり - 要確認")

    # 最終サマリー
    print(f"\n{'='*70}")
    print("検証結果サマリー")
    print(f"{'='*70}")

    phase_9_status = "✅ 合格" if both_filled / total_records >= 0.95 else "❌ 不合格"
    phase_10_status = "✅ 合格" if abs(kb_count - emb_count) <= 5 else "❌ 不合格"

    print(f"Phase 4.3x-9 (source_id/user_id): {phase_9_status}")
    print(f"Phase 4.3x-10 (データ整合性): {phase_10_status}")

    if phase_9_status == "✅ 合格" and phase_10_status == "✅ 合格":
        print(f"\n🎉 全検証合格！Phase 5.1（統合テスト）へ進めます")
    else:
        print(f"\n⚠️ 検証不合格 - 問題を修正してください")

    print(f"{'='*70}\n")


if __name__ == "__main__":
    try:
        validate_vectorization()
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
