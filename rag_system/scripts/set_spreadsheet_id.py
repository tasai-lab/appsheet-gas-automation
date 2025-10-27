#!/usr/bin/env python3
"""
Spreadsheet ID自動設定スクリプト

Vector DB SpreadsheetのIDを以下のファイルに自動設定:
1. common_modules/vector_db_sync.gs
2. rag_system/backend/.env
3. 看護系5プロジェクトのvector_db_sync.gs
"""

import os
import re
from pathlib import Path

# ベースディレクトリ
BASE_DIR = Path(__file__).parent.parent.parent
COMMON_MODULES_DIR = BASE_DIR / "common_modules"
BACKEND_DIR = BASE_DIR / "rag_system" / "backend"
PROJECTS_BASE = BASE_DIR / "gas_projects" / "projects" / "nursing"

# 対象プロジェクト
TARGET_PROJECTS = [
    "Appsheet_訪問看護_書類仕分け",
    "Appsheet_訪問看護_計画書問題点",
    "Appsheet_訪問看護_計画書問題点_評価",
    "Appsheet_訪問看護_報告書",
    "Appsheet_訪問看護_定期スケジュール"
]


def set_spreadsheet_id_in_file(file_path: Path, spreadsheet_id: str, pattern: str, replacement: str) -> bool:
    """
    ファイル内のSpreadsheet IDを設定

    Args:
        file_path: ファイルパス
        spreadsheet_id: 設定するSpreadsheet ID
        pattern: 検索パターン
        replacement: 置換パターン

    Returns:
        成功時True
    """
    if not file_path.exists():
        print(f"   ⚠️  ファイルが見つかりません: {file_path}")
        return False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 既に設定されているかチェック
    if spreadsheet_id in content:
        print(f"   ✅ 既に設定済み")
        return True

    # パターンマッチと置換
    new_content = re.sub(pattern, replacement.format(spreadsheet_id=spreadsheet_id), content)

    if new_content == content:
        print(f"   ❌ パターンが見つかりませんでした")
        return False

    # ファイルに書き込み
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"   ✅ Spreadsheet ID設定完了")
    return True


def set_spreadsheet_id(spreadsheet_id: str, dry_run=False):
    """
    全ファイルにSpreadsheet IDを設定

    Args:
        spreadsheet_id: 設定するSpreadsheet ID
        dry_run: Trueの場合、実際の書き込みは行わない

    Returns:
        成功時True
    """
    print("=" * 60)
    print("Spreadsheet ID自動設定スクリプト")
    print("=" * 60)
    print()
    print(f"Spreadsheet ID: {spreadsheet_id}")
    print()

    if dry_run:
        print("🔍 DRY RUN モード（実際の書き込みは行いません）")
        print()

    success_count = 0
    total_count = 0

    # 1. common_modules/vector_db_sync.gs
    print("1. common_modules/vector_db_sync.gs")
    file_path = COMMON_MODULES_DIR / "vector_db_sync.gs"
    pattern = r"spreadsheetId:\s*'[^']*'"
    replacement = "spreadsheetId: '{spreadsheet_id}'"

    if not dry_run:
        if set_spreadsheet_id_in_file(file_path, spreadsheet_id, pattern, replacement):
            success_count += 1
    else:
        print(f"   📝 設定予定")
    total_count += 1
    print()

    # 2. rag_system/backend/.env
    print("2. rag_system/backend/.env")
    env_file = BACKEND_DIR / ".env"

    if not env_file.exists():
        # .env.exampleから作成
        env_example = BACKEND_DIR / ".env.example"
        if env_example.exists():
            print(f"   📝 .envファイルを.env.exampleから作成")
            if not dry_run:
                with open(env_example, 'r', encoding='utf-8') as f:
                    content = f.read()
                with open(env_file, 'w', encoding='utf-8') as f:
                    f.write(content)

    if env_file.exists():
        pattern = r"VECTOR_DB_SPREADSHEET_ID=.*"
        replacement = f"VECTOR_DB_SPREADSHEET_ID={spreadsheet_id}"

        if not dry_run:
            with open(env_file, 'r', encoding='utf-8') as f:
                content = f.read()

            if "VECTOR_DB_SPREADSHEET_ID" in content:
                # 既存の行を置換
                new_content = re.sub(pattern, replacement, content)
            else:
                # 新規追加
                new_content = content + f"\n{replacement}\n"

            with open(env_file, 'w', encoding='utf-8') as f:
                f.write(new_content)

            print(f"   ✅ Spreadsheet ID設定完了")
            success_count += 1
        else:
            print(f"   📝 設定予定")
    else:
        print(f"   ⚠️  .envファイルが見つかりません")

    total_count += 1
    print()

    # 3. 看護系5プロジェクトのvector_db_sync.gs
    print("3. 看護系5プロジェクトのvector_db_sync.gs")
    for project in TARGET_PROJECTS:
        print(f"   📁 {project}")
        file_path = PROJECTS_BASE / project / "scripts" / "vector_db_sync.gs"

        if not file_path.exists():
            print(f"      ⚠️  ファイルが見つかりません")
            continue

        pattern = r"spreadsheetId:\s*'[^']*'"
        replacement = "spreadsheetId: '{spreadsheet_id}'"

        if not dry_run:
            if set_spreadsheet_id_in_file(file_path, spreadsheet_id, pattern, replacement):
                success_count += 1
        else:
            print(f"      📝 設定予定")

        total_count += 1

    print()
    print("=" * 60)

    if dry_run:
        print("✅ DRY RUN 完了")
    else:
        print("✅ 設定完了")

    print(f"   成功: {success_count}/{total_count} ファイル")
    print("=" * 60)

    return success_count == total_count


def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description="Spreadsheet ID自動設定スクリプト")
    parser.add_argument(
        "spreadsheet_id",
        help="設定するSpreadsheet ID"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の書き込みは行わず、確認のみ"
    )

    args = parser.parse_args()

    # Spreadsheet IDの検証
    if not re.match(r'^[a-zA-Z0-9_-]+$', args.spreadsheet_id):
        print("❌ エラー: 無効なSpreadsheet ID形式です")
        return 1

    success = set_spreadsheet_id(args.spreadsheet_id, dry_run=args.dry_run)

    if not args.dry_run and success:
        print()
        print("次のステップ:")
        print("1. git diff で変更を確認")
        print("2. git commit & push")
        print("3. clasp push で5プロジェクトをデプロイ")

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
