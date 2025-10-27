#!/usr/bin/env python3
"""
GASプロジェクトからSpreadsheet IDを自動抽出するヘルパースクリプト

Usage:
    python scripts/find_spreadsheet_ids.py
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Optional

# プロジェクトルート
ROOT_DIR = Path(__file__).parent.parent.parent
GAS_PROJECTS_DIR = ROOT_DIR / "gas_projects"
DATA_SOURCES_FILE = Path(__file__).parent / "data_sources.json"

# データソース名とGASプロジェクト名のマッピング
DATA_SOURCE_TO_GAS_PROJECT = {
    "nursing_regular": "Appsheet_訪問看護_通常記録",
    "nursing_mental": "Appsheet_訪問看護_精神科記録",
    "nursing_plan": "Appsheet_訪問看護_計画書問題点",
    "nursing_plan_eval": "Appsheet_訪問看護_計画書問題点_評価",
    "nursing_report": "Appsheet_訪問看護_報告書",
    "clients_basic": "Appsheet_利用者_基本情報上書き",  # または Appsheet_利用者_反映
    "clients_qa": "Appsheet_利用者_質疑応答",
    "clients_facesheet": "Appsheet_利用者_フェースシート",
    "clients_family": "Appsheet_利用者_家族情報作成",
    "calls_summary": "Appsheet_通話_要約生成",
    "calls_qa": "Appsheet_通話_質疑応答",
    "calls_threads": "Appsheet_ALL_スレッド更新",
    "sales_report": "Appsheet_営業レポート",
    "sales_card": "Appsheet_名刺取り込み",
    "automation_receipt": "Automation_レシート",
}


def find_spreadsheet_id_in_file(file_path: Path) -> Optional[str]:
    """
    ファイル内からSpreadsheet IDを抽出

    パターン:
    - const TARGET_SPREADSHEET_ID = '1ABC...XYZ';
    - const DATA_SPREADSHEET_ID = '1ABC...XYZ';
    - const SPREADSHEET_ID = '1ABC...XYZ';
    """
    try:
        content = file_path.read_text(encoding='utf-8')

        # EXECUTION_LOG_SPREADSHEET_IDは除外
        patterns = [
            r'(?:TARGET_SPREADSHEET_ID|DATA_SPREADSHEET_ID|SPREADSHEET_ID)\s*=\s*["\']([a-zA-Z0-9_-]{30,})["\']',
        ]

        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                spreadsheet_id = match.group(1)
                # 実行ログSpreadsheet IDは除外
                if spreadsheet_id != "16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA":
                    return spreadsheet_id

        return None

    except Exception as e:
        print(f"⚠️ ファイル読み込みエラー: {file_path}: {e}")
        return None


def find_gas_project_dir(project_name: str) -> Optional[Path]:
    """GASプロジェクトディレクトリを検索"""
    for root, dirs, files in os.walk(GAS_PROJECTS_DIR):
        for dir_name in dirs:
            if dir_name == project_name:
                return Path(root) / dir_name
    return None


def extract_spreadsheet_ids() -> Dict[str, Optional[str]]:
    """全データソースのSpreadsheet IDを抽出"""
    results = {}

    for data_source_key, gas_project_name in DATA_SOURCE_TO_GAS_PROJECT.items():
        print(f"\n🔍 検索中: {data_source_key} ({gas_project_name})")

        # GASプロジェクトディレクトリを検索
        project_dir = find_gas_project_dir(gas_project_name)

        if not project_dir:
            print(f"  ❌ プロジェクトディレクトリが見つかりません: {gas_project_name}")
            results[data_source_key] = None
            continue

        print(f"  📁 見つかりました: {project_dir}")

        # config.gs / Config.gs を検索
        config_files = list(project_dir.rglob("config.gs")) + list(project_dir.rglob("Config.gs"))

        if not config_files:
            print(f"  ⚠️ config.gs が見つかりません")
            results[data_source_key] = None
            continue

        # Spreadsheet IDを抽出
        for config_file in config_files:
            spreadsheet_id = find_spreadsheet_id_in_file(config_file)
            if spreadsheet_id:
                print(f"  ✅ 見つかりました: {spreadsheet_id}")
                print(f"     ファイル: {config_file}")
                results[data_source_key] = spreadsheet_id
                break
        else:
            print(f"  ⚠️ Spreadsheet IDが見つかりませんでした")
            results[data_source_key] = None

    return results


def update_data_sources_json(spreadsheet_ids: Dict[str, Optional[str]]):
    """data_sources.jsonを更新"""
    if not DATA_SOURCES_FILE.exists():
        print(f"\n❌ {DATA_SOURCES_FILE} が見つかりません")
        return

    with open(DATA_SOURCES_FILE, 'r', encoding='utf-8') as f:
        data_sources = json.load(f)

    updated_count = 0
    for data_source_key, spreadsheet_id in spreadsheet_ids.items():
        if spreadsheet_id and data_source_key in data_sources:
            data_sources[data_source_key]['spreadsheet_id'] = spreadsheet_id
            updated_count += 1

    # バックアップ作成
    backup_file = DATA_SOURCES_FILE.parent / "data_sources.json.backup"
    DATA_SOURCES_FILE.rename(backup_file)
    print(f"\n💾 バックアップ作成: {backup_file}")

    # 更新したJSONを保存
    with open(DATA_SOURCES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data_sources, f, ensure_ascii=False, indent=2)

    print(f"✅ {DATA_SOURCES_FILE} を更新しました ({updated_count}件)")


def main():
    print("=" * 60)
    print("GASプロジェクトからSpreadsheet IDを自動抽出")
    print("=" * 60)

    # Spreadsheet IDを抽出
    spreadsheet_ids = extract_spreadsheet_ids()

    # サマリー表示
    print("\n" + "=" * 60)
    print("抽出結果サマリー")
    print("=" * 60)

    found_count = sum(1 for sid in spreadsheet_ids.values() if sid)
    total_count = len(spreadsheet_ids)

    print(f"\n✅ 見つかった: {found_count} / {total_count}")
    print(f"❌ 見つからない: {total_count - found_count} / {total_count}")

    print("\n【詳細】")
    for data_source_key, spreadsheet_id in spreadsheet_ids.items():
        status = "✅" if spreadsheet_id else "❌"
        print(f"  {status} {data_source_key:20s} : {spreadsheet_id or '未設定'}")

    # data_sources.jsonを更新
    if found_count > 0:
        print("\n" + "=" * 60)
        update_data_sources_json(spreadsheet_ids)
    else:
        print("\n⚠️ Spreadsheet IDが1つも見つからなかったため、data_sources.jsonは更新しません")

    print("\n" + "=" * 60)
    print("次のステップ:")
    print("=" * 60)
    print(f"1. {DATA_SOURCES_FILE} を開いて、未設定のSpreadsheet IDを手動で入力")
    print("2. python scripts/vectorize_existing_data.py --list-sources で確認")
    print("3. python scripts/vectorize_existing_data.py --all --dry-run でテスト")


if __name__ == "__main__":
    main()
