#!/usr/bin/env python3
"""
GASプロジェクトから詳細にSpreadsheet IDを抽出

各プロジェクトのREADME.md, SPECIFICATIONS.md, config*.gs, *.mdを解析して
Spreadsheet IDとコンテキストを抽出します。
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

ROOT_DIR = Path(__file__).parent.parent.parent
GAS_PROJECTS_DIR = ROOT_DIR / "gas_projects" / "projects"

# 除外するSpreadsheet ID（実行ログ、Vector DB、フォルダーID）
EXCLUDE_IDS = {
    "16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA",  # 実行ログ
    "16swPUizvdlyPxUjbDpVl9-VBDJZO91kX",  # 実行ログフォルダー
    "1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA",  # Vector DB
}

# 正規表現パターン（Spreadsheet IDは通常30-50文字）
SPREADSHEET_ID_PATTERN = re.compile(r'\b(1[a-zA-Z0-9_-]{30,50})\b')

# Access Keyのパターン（除外用）
ACCESS_KEY_PATTERN = re.compile(r'V2-[a-zA-Z0-9]{5,}')

# GASプロジェクト名とdata_sourcesのマッピング
PROJECT_NAME_MAPPING = {
    "Appsheet_訪問看護_通常記録": "nursing_regular",
    "Appsheet_訪問看護_精神科記録": "nursing_mental",
    "Appsheet_訪問看護_計画書問題点": "nursing_plan",
    "Appsheet_訪問看護_計画書問題点_評価": "nursing_plan_eval",
    "Appsheet_訪問看護_報告書": "nursing_report",
    "Appsheet_利用者_基本情報上書き": "clients_basic",
    "Appsheet_利用者_質疑応答": "clients_qa",
    "Appsheet_利用者_フェースシート": "clients_facesheet",
    "Appsheet_利用者_家族情報作成": "clients_family",
    "Appsheet_通話_要約生成": "calls_summary",
    "Appsheet_通話_質疑応答": "calls_qa",
    "Appsheet_ALL_スレッド更新": "calls_threads",
    "Appsheet_営業レポート": "sales_report",
    "Appsheet_名刺取り込み": "sales_card",
    "Automation_レシート": "automation_receipt",
}


def is_valid_spreadsheet_id(id_str: str) -> bool:
    """有効なSpreadsheet IDかチェック"""
    # 長すぎる（Access Keyの可能性）
    if len(id_str) > 60:
        return False

    # 短すぎる
    if len(id_str) < 30:
        return False

    # Access Keyのパターンに一致
    if ACCESS_KEY_PATTERN.search(id_str):
        return False

    # 除外リストに含まれる
    if id_str in EXCLUDE_IDS:
        return False

    return True


def extract_spreadsheet_ids_from_file(file_path: Path) -> List[Tuple[str, str]]:
    """
    ファイルからSpreadsheet IDとコンテキストを抽出

    Returns:
        List of (spreadsheet_id, context_line)
    """
    results = []

    try:
        content = file_path.read_text(encoding='utf-8')
        lines = content.split('\n')

        for i, line in enumerate(lines):
            matches = SPREADSHEET_ID_PATTERN.findall(line)

            for match in matches:
                if is_valid_spreadsheet_id(match):
                    # 前後の行をコンテキストとして取得
                    context_lines = []
                    for j in range(max(0, i-1), min(len(lines), i+2)):
                        context_lines.append(lines[j].strip())
                    context = " | ".join(context_lines)

                    results.append((match, context))

    except Exception as e:
        pass

    return results


def find_project_directory(project_name: str) -> Path:
    """プロジェクトディレクトリを検索"""
    for domain_dir in GAS_PROJECTS_DIR.iterdir():
        if domain_dir.is_dir():
            project_dir = domain_dir / project_name
            if project_dir.exists():
                return project_dir
    return None


def extract_all_spreadsheet_ids():
    """全プロジェクトからSpreadsheet IDを抽出"""
    results = {}

    for gas_project_name, data_source_key in PROJECT_NAME_MAPPING.items():
        print(f"\n{'='*70}")
        print(f"🔍 {gas_project_name} ({data_source_key})")
        print(f"{'='*70}")

        project_dir = find_project_directory(gas_project_name)

        if not project_dir:
            print(f"  ❌ プロジェクトディレクトリが見つかりません")
            results[data_source_key] = None
            continue

        print(f"  📁 {project_dir}")

        # 検索対象ファイル
        target_files = []
        target_files.extend(project_dir.rglob("*.gs"))
        target_files.extend(project_dir.rglob("*.md"))
        target_files.extend(project_dir.rglob("*.json"))

        # Spreadsheet IDを収集
        found_ids = {}

        for file_path in target_files:
            # バックアップファイルや不要なファイルをスキップ
            if '_backup' in str(file_path) or '.git' in str(file_path):
                continue

            ids_with_context = extract_spreadsheet_ids_from_file(file_path)

            for spreadsheet_id, context in ids_with_context:
                if spreadsheet_id not in found_ids:
                    found_ids[spreadsheet_id] = []

                found_ids[spreadsheet_id].append({
                    'file': str(file_path.relative_to(project_dir)),
                    'context': context[:150]  # 最初の150文字のみ
                })

        if found_ids:
            print(f"  ✅ 見つかったSpreadsheet ID: {len(found_ids)}個\n")

            for spreadsheet_id, locations in found_ids.items():
                print(f"    📊 {spreadsheet_id}")

                for loc in locations[:2]:  # 最初の2箇所のみ表示
                    print(f"       - {loc['file']}")
                    print(f"         {loc['context']}")

                if len(locations) > 2:
                    print(f"       ... 他 {len(locations) - 2}箇所")
                print()

            # 最も可能性の高いIDを選択（最も多く出現するID）
            most_common_id = max(found_ids.keys(), key=lambda k: len(found_ids[k]))
            results[data_source_key] = most_common_id
            print(f"  ✨ 推奨ID: {most_common_id}")

        else:
            print(f"  ⚠️ Spreadsheet IDが見つかりませんでした")
            results[data_source_key] = None

    return results


def main():
    print("="*70)
    print("GASプロジェクトから詳細にSpreadsheet IDを抽出")
    print("="*70)

    results = extract_all_spreadsheet_ids()

    # サマリー
    print("\n" + "="*70)
    print("📊 抽出結果サマリー")
    print("="*70)

    found_count = sum(1 for v in results.values() if v)
    total_count = len(results)

    print(f"\n✅ 見つかった: {found_count} / {total_count}")
    print(f"❌ 見つからない: {total_count - found_count} / {total_count}\n")

    print("【推奨Spreadsheet ID】")
    for data_source_key, spreadsheet_id in results.items():
        status = "✅" if spreadsheet_id else "❌"
        print(f"  {status} {data_source_key:20s} : {spreadsheet_id or '未設定'}")

    # JSON出力
    import json
    output_file = Path(__file__).parent / "extracted_spreadsheet_ids.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n💾 結果を保存しました: {output_file}")
    print("\n次のステップ:")
    print("1. extracted_spreadsheet_ids.json を確認")
    print("2. 正しいIDをdata_sources.jsonにコピー")
    print("3. python scripts/vectorize_existing_data.py --list-sources で確認")


if __name__ == "__main__":
    main()
