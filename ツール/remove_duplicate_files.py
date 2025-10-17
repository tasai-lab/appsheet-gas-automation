#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
GASプロジェクトから重複・不要なファイルを削除するスクリプト

共通モジュール化により不要になったファイルを一括削除します。
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Set
import shutil
from datetime import datetime

# プロジェクトのルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent
GAS_PROJECTS_DIR = PROJECT_ROOT / "gas_projects"

# 削除対象のファイル名パターン
DUPLICATE_FILES_TO_REMOVE = [
    "ExecutionLogger.gs",
    "AppSheetConnector.gs",
    "ValidationUtils.gs",
    "ErrorHandler.gs",
    "CommonWebhook.gs"
]

# 共通モジュールフォルダ（このフォルダ内のファイルは削除しない）
COMMON_MODULE_FOLDER = "共通モジュール"


def find_duplicate_files() -> Dict[str, List[Path]]:
    """
    重複ファイルを検索

    Returns:
        Dict[str, List[Path]]: ファイル名ごとの重複ファイルパスリスト
    """
    duplicate_files = {}

    # 各削除対象ファイルを検索
    for filename in DUPLICATE_FILES_TO_REMOVE:
        files = list(GAS_PROJECTS_DIR.glob(f"**/{filename}"))
        # 共通モジュール以外のファイルのみを対象とする
        files = [f for f in files if COMMON_MODULE_FOLDER not in str(f)]

        if files:
            duplicate_files[filename] = files

    return duplicate_files


def find_backup_files() -> List[Path]:
    """
    バックアップファイル(.backup)を検索

    Returns:
        List[Path]: バックアップファイルのパスリスト
    """
    return list(GAS_PROJECTS_DIR.glob("**/*.backup"))


def delete_files(files_to_delete: List[Path], dry_run: bool = False) -> Dict[str, any]:
    """
    ファイルを削除

    Args:
        files_to_delete: 削除するファイルのパスリスト
        dry_run: True の場合、実際には削除せずにシミュレーションのみ実行

    Returns:
        Dict[str, any]: 削除結果の統計情報
    """
    results = {
        "total_files": len(files_to_delete),
        "deleted_files": 0,
        "failed_files": 0,
        "errors": [],
        "deleted_paths": []
    }

    for file_path in files_to_delete:
        try:
            if dry_run:
                print(f"[DRY RUN] 削除予定: {file_path}")
                results["deleted_files"] += 1
                results["deleted_paths"].append(str(file_path))
            else:
                if file_path.exists():
                    file_path.unlink()
                    print(f"[OK] 削除完了: {file_path}")
                    results["deleted_files"] += 1
                    results["deleted_paths"].append(str(file_path))
                else:
                    print(f"[WARNING] ファイルが存在しません: {file_path}")
        except Exception as e:
            print(f"[ERROR] 削除失敗: {file_path} - エラー: {e}")
            results["failed_files"] += 1
            results["errors"].append({
                "file": str(file_path),
                "error": str(e)
            })

    return results


def main(dry_run: bool = False):
    """
    メイン処理

    Args:
        dry_run: True の場合、実際には削除せずにシミュレーションのみ実行
    """
    print("=" * 60)
    print("GASプロジェクト重複ファイル削除スクリプト")
    print("=" * 60)
    print()

    if dry_run:
        print("[DRY RUN] モード: 実際のファイル削除は行いません")
        print()

    # 重複ファイルを検索
    print("重複ファイルを検索中...")
    duplicate_files = find_duplicate_files()

    # バックアップファイルを検索
    print("バックアップファイルを検索中...")
    backup_files = find_backup_files()

    # 削除対象ファイルのリスト作成
    all_files_to_delete = []

    # 重複ファイルの統計表示
    print()
    print("検出された重複ファイル:")
    print("-" * 40)

    for filename, file_paths in duplicate_files.items():
        print(f"  {filename}: {len(file_paths)} 個")
        all_files_to_delete.extend(file_paths)

    print(f"  .backupファイル: {len(backup_files)} 個")
    all_files_to_delete.extend(backup_files)

    total_files = len(all_files_to_delete)

    if total_files == 0:
        print()
        print("削除対象のファイルはありません")
        return

    print()
    print(f"削除対象ファイル合計: {total_files} 個")
    print()

    # プロジェクトごとの削除ファイル数を集計
    project_files = {}
    for file_path in all_files_to_delete:
        project_name = file_path.parts[file_path.parts.index("gas_projects") + 1]
        if project_name not in project_files:
            project_files[project_name] = []
        project_files[project_name].append(file_path.name)

    print("プロジェクトごとの削除対象ファイル:")
    print("-" * 40)
    for project, files in sorted(project_files.items()):
        print(f"  {project}: {len(files)} 個")
        for filename in sorted(set(files)):
            count = files.count(filename)
            if count > 1:
                print(f"    - {filename} ({count}個)")
            else:
                print(f"    - {filename}")

    print()

    if not dry_run:
        # 確認プロンプト
        response = input(f"[WARNING] {total_files} 個のファイルを削除します。続行しますか？ (y/n): ")
        if response.lower() != 'y':
            print("削除をキャンセルしました")
            return

    # ファイル削除実行
    print()
    print("ファイルを削除中...")
    print("-" * 40)

    results = delete_files(all_files_to_delete, dry_run)

    # 結果サマリー表示
    print()
    print("=" * 60)
    print("削除結果サマリー")
    print("=" * 60)
    print(f"削除成功: {results['deleted_files']} 個")
    print(f"削除失敗: {results['failed_files']} 個")

    if results['errors']:
        print()
        print("エラー詳細:")
        for error in results['errors']:
            print(f"  - {error['file']}")
            print(f"    エラー: {error['error']}")

    # 結果をJSONファイルに保存
    result_file = PROJECT_ROOT / "ツール" / "duplicate_removal_results.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "dry_run": dry_run,
            "statistics": {
                "total_files": results["total_files"],
                "deleted_files": results["deleted_files"],
                "failed_files": results["failed_files"]
            },
            "deleted_paths": results["deleted_paths"],
            "errors": results["errors"]
        }, f, ensure_ascii=False, indent=2)

    print()
    print(f"結果を保存しました: {result_file}")

    if not dry_run and results['deleted_files'] > 0:
        print()
        print("重複ファイルの削除が完了しました！")
        print("共通モジュールは gas_projects/共通モジュール/ に保持されています。")


if __name__ == "__main__":
    import sys

    # コマンドライン引数で --dry-run を指定可能
    dry_run = "--dry-run" in sys.argv

    main(dry_run)