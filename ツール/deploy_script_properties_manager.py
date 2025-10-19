#!/usr/bin/env python3
"""
スクリプトプロパティ管理モジュールを全プロジェクトに展開

このスクリプトは以下を実行します:
1. common_modules/script_properties_manager.gs を全プロジェクトにコピー
2. common_modules/duplication_prevention.gs を全プロジェクトに上書き
3. 各プロジェクトの scripts ディレクトリに配置

Usage:
    python deploy_script_properties_manager.py [--dry-run] [--filter PATTERN]
"""

import os
import shutil
import argparse
from pathlib import Path

# ルートディレクトリ
ROOT_DIR = Path(__file__).parent.parent
COMMON_MODULES_DIR = ROOT_DIR / "common_modules"
GAS_PROJECTS_DIR = ROOT_DIR / "gas_projects"

# 展開するファイル
FILES_TO_DEPLOY = [
    "script_properties_manager.gs",
    "duplication_prevention.gs"
]


def find_gas_projects(filter_pattern=None):
    """
    GASプロジェクトを検索

    Args:
        filter_pattern (str): フィルタパターン（プロジェクト名の部分一致）

    Returns:
        list: プロジェクトディレクトリのリスト
    """
    projects = []

    for root, dirs, files in os.walk(GAS_PROJECTS_DIR):
        # scripts ディレクトリがあるプロジェクトを探す
        if "scripts" in dirs and ".clasp.json" in files:
            project_path = Path(root)
            project_name = project_path.name

            # フィルタが指定されている場合は部分一致チェック
            if filter_pattern and filter_pattern.lower() not in project_name.lower():
                continue

            projects.append(project_path)

    # ソート
    projects.sort(key=lambda p: p.name)

    return projects


def deploy_to_project(project_path, dry_run=False):
    """
    プロジェクトにファイルを展開

    Args:
        project_path (Path): プロジェクトディレクトリ
        dry_run (bool): dry-runモード

    Returns:
        tuple: (成功数, スキップ数, エラー数)
    """
    scripts_dir = project_path / "scripts"

    if not scripts_dir.exists():
        print(f"  ❌ scripts ディレクトリが見つかりません: {project_path.name}")
        return (0, 0, 1)

    success_count = 0
    skip_count = 0
    error_count = 0

    for filename in FILES_TO_DEPLOY:
        source_file = COMMON_MODULES_DIR / filename
        dest_file = scripts_dir / filename

        if not source_file.exists():
            print(f"  ⚠️  ソースファイルが見つかりません: {filename}")
            error_count += 1
            continue

        # 既存ファイルがある場合は上書き確認
        if dest_file.exists():
            # 内容が同じならスキップ
            if source_file.read_text() == dest_file.read_text():
                print(f"  ⏭️  {filename} - 既に最新版です")
                skip_count += 1
                continue

        # ファイルをコピー
        if dry_run:
            print(f"  [DRY-RUN] {filename} をコピー")
        else:
            try:
                shutil.copy2(source_file, dest_file)
                print(f"  ✅ {filename} をコピーしました")
                success_count += 1
            except Exception as e:
                print(f"  ❌ {filename} のコピーに失敗: {e}")
                error_count += 1

    return (success_count, skip_count, error_count)


def main():
    parser = argparse.ArgumentParser(
        description="スクリプトプロパティ管理モジュールを全プロジェクトに展開"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際にファイルをコピーせず、実行内容だけを表示"
    )
    parser.add_argument(
        "--filter",
        type=str,
        help="プロジェクト名のフィルタ（部分一致）"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="詳細な出力を表示"
    )

    args = parser.parse_args()

    print("=" * 80)
    print("スクリプトプロパティ管理モジュールの展開")
    print("=" * 80)

    if args.dry_run:
        print("⚠️  DRY-RUNモード: ファイルは実際にコピーされません\n")

    # プロジェクトを検索
    projects = find_gas_projects(args.filter)

    if not projects:
        print("❌ プロジェクトが見つかりませんでした")
        return

    print(f"📂 {len(projects)}個のプロジェクトが見つかりました")
    if args.filter:
        print(f"   フィルタ: '{args.filter}'\n")
    else:
        print()

    # 各プロジェクトに展開
    total_success = 0
    total_skip = 0
    total_error = 0
    processed_projects = 0

    for project_path in projects:
        print(f"📦 {project_path.name}")

        success, skip, error = deploy_to_project(project_path, args.dry_run)

        total_success += success
        total_skip += skip
        total_error += error

        if success > 0 or error > 0:
            processed_projects += 1

        print()

    # 結果サマリー
    print("=" * 80)
    print("展開完了")
    print("=" * 80)
    print(f"処理したプロジェクト: {processed_projects}/{len(projects)}")
    print(f"  ✅ 成功: {total_success}ファイル")
    print(f"  ⏭️  スキップ: {total_skip}ファイル")
    print(f"  ❌ エラー: {total_error}ファイル")

    if args.dry_run:
        print("\n⚠️  DRY-RUNモードでした。実際にファイルをコピーするには --dry-run を外して実行してください。")
    else:
        print("\n🎉 展開が完了しました！")
        print("\n次のステップ:")
        print("  1. 各プロジェクトで clasp push を実行")
        print("  2. GASエディタでテスト関数を実行:")
        print("     - testScriptPropertiesManager()")
        print("     - listScriptProperties()")
        print("  3. スクリプトプロパティを初期化:")
        print("     - initializeScriptPropertiesForProject()")


if __name__ == "__main__":
    main()
