#!/usr/bin/env python3
"""
extracted_spreadsheet_ids.jsonからdata_sources.jsonを更新

ただし、GAS実行ログのIDは除外し、有効なデータソースのみを使用
"""

import json
from pathlib import Path

# ファイルパス
EXTRACTED_IDS_FILE = Path(__file__).parent / "extracted_spreadsheet_ids.json"
DATA_SOURCES_FILE = Path(__file__).parent / "data_sources.json"

# 除外するSpreadsheet ID (GAS実行ログ)
EXCLUDE_IDS = {
    "15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE",  # GAS実行ログ
    "16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA",  # 統合実行ログ
    "16swPUizvdlyPxUjbDpVl9-VBDJZO91kX",  # 実行ログフォルダー
    "1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA",  # Vector DB
}

# 有効と確認されたSpreadsheet ID（コンテキストから判定）
VALID_IDS = {
    "1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw",  # 訪問看護_通常記録 (masterId)
    "1auRrqem2h3p7tcVs34sQci6eQeYflhcP-TAg1S4islg",  # 営業レポート (SALES_ID)
    "1ctSjcAlu9VSloPT9S9hsTyTd7yCw5XvNtF7-URyBeKo",  # 名刺取り込み (関係機関_置換SS)
}


def main():
    print("="*70)
    print("data_sources.jsonを更新")
    print("="*70)

    # extracted_spreadsheet_ids.jsonを読み込み
    with open(EXTRACTED_IDS_FILE, 'r', encoding='utf-8') as f:
        extracted_ids = json.load(f)

    # data_sources.jsonを読み込み
    with open(DATA_SOURCES_FILE, 'r', encoding='utf-8') as f:
        data_sources = json.load(f)

    # バックアップ作成
    backup_file = DATA_SOURCES_FILE.parent / "data_sources.json.backup2"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data_sources, f, ensure_ascii=False, indent=2)
    print(f"\n💾 バックアップ作成: {backup_file}\n")

    # 更新
    updated_count = 0
    skipped_count = 0

    for data_source_key, spreadsheet_id in extracted_ids.items():
        if not spreadsheet_id:
            print(f"  ⏭️  {data_source_key:20s} : IDなし（スキップ）")
            continue

        # 除外IDはスキップ
        if spreadsheet_id in EXCLUDE_IDS:
            print(f"  ⏭️  {data_source_key:20s} : {spreadsheet_id[:20]}... (GAS実行ログ、スキップ)")
            skipped_count += 1
            continue

        # 有効なIDのみ更新
        if spreadsheet_id in VALID_IDS:
            data_sources[data_source_key]['spreadsheet_id'] = spreadsheet_id
            print(f"  ✅ {data_source_key:20s} : {spreadsheet_id}")
            updated_count += 1
        else:
            print(f"  ⚠️  {data_source_key:20s} : {spreadsheet_id[:20]}... (未検証、スキップ)")
            skipped_count += 1

    # 保存
    with open(DATA_SOURCES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data_sources, f, ensure_ascii=False, indent=2)

    print("\n" + "="*70)
    print("📊 更新結果")
    print("="*70)
    print(f"✅ 更新: {updated_count}件")
    print(f"⏭️  スキップ: {skipped_count}件")
    print(f"❌ 未設定: {15 - updated_count - skipped_count}件")

    print("\n⚠️  重要: 以下のプロジェクトはSpreadsheet IDが未設定です")
    print("AppSheetエディタから直接確認する必要があります：\n")

    unset_projects = []
    for data_source_key, config in data_sources.items():
        if config['spreadsheet_id'] == "【AppSheetアプリのSpreadsheet IDを入力】":
            unset_projects.append(f"  - {config['name']} ({data_source_key})")

    if unset_projects:
        for project in unset_projects:
            print(project)

    print("\n次のステップ:")
    print("1. AppSheetエディタで未設定のSpreadsheet IDを確認")
    print("2. data_sources.jsonに手動で入力")
    print("3. python scripts/vectorize_existing_data.py --list-sources で確認")
    print("\n参考: scripts/HOW_TO_FIND_SPREADSHEET_IDS.md")


if __name__ == "__main__":
    main()
