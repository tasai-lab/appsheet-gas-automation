#!/usr/bin/env python3
"""
共通モジュール配布スクリプト

看護系5プロジェクトに以下の共通モジュールを配布:
- vector_db_sync.gs
- embeddings_service.gs
- logger.gs (最新版に更新)
"""

import os
import shutil
from pathlib import Path

# ベースディレクトリ
BASE_DIR = Path(__file__).parent.parent.parent
COMMON_MODULES_DIR = BASE_DIR / "common_modules"
PROJECTS_BASE = BASE_DIR / "gas_projects" / "projects" / "nursing"

# 対象プロジェクト（看護系5プロジェクト）
TARGET_PROJECTS = [
    "Appsheet_訪問看護_書類仕分け",
    "Appsheet_訪問看護_計画書問題点",
    "Appsheet_訪問看護_計画書問題点_評価",
    "Appsheet_訪問看護_報告書",
    "Appsheet_訪問看護_定期スケジュール"
]

# 配布する共通モジュール
MODULES_TO_DISTRIBUTE = [
    "vector_db_sync.gs",
    "embeddings_service.gs",
    "logger.gs"
]


def distribute_modules(dry_run=False):
    """
    共通モジュールを対象プロジェクトに配布

    Args:
        dry_run: Trueの場合、実際のコピーは行わず確認のみ
    """
    print("=" * 60)
    print("共通モジュール配布スクリプト")
    print("=" * 60)
    print()

    if dry_run:
        print("🔍 DRY RUN モード（実際のコピーは行いません）")
        print()

    # 配布対象モジュールの存在確認
    print("1. 共通モジュール確認:")
    for module in MODULES_TO_DISTRIBUTE:
        module_path = COMMON_MODULES_DIR / module
        if module_path.exists():
            print(f"   ✅ {module}")
        else:
            print(f"   ❌ {module} - 見つかりません")
            return False
    print()

    # 対象プロジェクトの確認
    print("2. 対象プロジェクト確認:")
    existing_projects = []
    for project in TARGET_PROJECTS:
        project_path = PROJECTS_BASE / project
        if project_path.exists():
            print(f"   ✅ {project}")
            existing_projects.append(project)
        else:
            print(f"   ⚠️  {project} - 見つかりません（スキップ）")
    print()

    if not existing_projects:
        print("❌ 対象プロジェクトが見つかりませんでした")
        return False

    # モジュール配布
    print("3. モジュール配布:")
    copied_count = 0

    for project in existing_projects:
        print(f"\n   📁 {project}")
        project_scripts_dir = PROJECTS_BASE / project / "scripts"

        if not project_scripts_dir.exists():
            print(f"      ⚠️  scriptsディレクトリが存在しません（スキップ）")
            continue

        for module in MODULES_TO_DISTRIBUTE:
            source = COMMON_MODULES_DIR / module
            dest = project_scripts_dir / module

            try:
                if dry_run:
                    if dest.exists():
                        print(f"      📝 {module} - 更新予定")
                    else:
                        print(f"      ➕ {module} - 新規追加予定")
                else:
                    shutil.copy2(source, dest)
                    if dest.exists():
                        print(f"      ✅ {module} - コピー完了")
                        copied_count += 1
                    else:
                        print(f"      ❌ {module} - コピー失敗")

            except Exception as e:
                print(f"      ❌ {module} - エラー: {e}")

    print()
    print("=" * 60)

    if dry_run:
        print("✅ DRY RUN 完了")
        print(f"   配布予定: {len(MODULES_TO_DISTRIBUTE)} モジュール × {len(existing_projects)} プロジェクト")
    else:
        print("✅ 配布完了")
        print(f"   コピー数: {copied_count} ファイル")

    print("=" * 60)

    return True


def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description="共通モジュール配布スクリプト")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際のコピーは行わず、確認のみ"
    )

    args = parser.parse_args()

    success = distribute_modules(dry_run=args.dry_run)

    if success:
        print()
        print("次のステップ:")
        print("1. vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId を設定")
        print("2. 各プロジェクトのWebhookハンドラーにVector DB同期コードを統合")
        print("3. clasp push でデプロイ")

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
