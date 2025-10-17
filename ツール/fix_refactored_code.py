#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
リファクタリング後のコードの問題を修正するスクリプト

個別引数への変更後に発生した以下の問題を修正：
- 変数の二重宣言
- 無意味な代入文
"""

import os
import re
from pathlib import Path
from typing import List

# プロジェクトのルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent
GAS_PROJECTS_DIR = PROJECT_ROOT / "gas_projects"


def fix_duplicate_declarations(code: str, param_names: List[str]) -> str:
    """
    引数で定義されている変数の二重宣言を削除

    Args:
        code: 修正対象のコード
        param_names: 関数の引数名リスト

    Returns:
        修正後のコード
    """
    modified = code

    for param in param_names:
        # let param = null; の削除
        pattern1 = rf'^\s*let\s+{param}\s*=\s*null\s*;\s*\n'
        modified = re.sub(pattern1, '', modified, flags=re.MULTILINE)

        # const param = null; の削除
        pattern2 = rf'^\s*const\s+{param}\s*=\s*null\s*;\s*\n'
        modified = re.sub(pattern2, '', modified, flags=re.MULTILINE)

        # var param = null; の削除
        pattern3 = rf'^\s*var\s+{param}\s*=\s*null\s*;\s*\n'
        modified = re.sub(pattern3, '', modified, flags=re.MULTILINE)

        # let param; の削除
        pattern4 = rf'^\s*let\s+{param}\s*;\s*\n'
        modified = re.sub(pattern4, '', modified, flags=re.MULTILINE)

        # const param; の削除
        pattern5 = rf'^\s*const\s+{param}\s*;\s*\n'
        modified = re.sub(pattern5, '', modified, flags=re.MULTILINE)

    return modified


def fix_self_assignments(code: str, param_names: List[str]) -> str:
    """
    自己代入文を削除

    Args:
        code: 修正対象のコード
        param_names: 関数の引数名リスト

    Returns:
        修正後のコード
    """
    modified = code

    for param in param_names:
        # param = param; の削除
        pattern1 = rf'^\s*{param}\s*=\s*{param}\s*;\s*\n'
        modified = re.sub(pattern1, '', modified, flags=re.MULTILINE)

        # const param = param; の削除
        pattern2 = rf'^\s*const\s+{param}\s*=\s*{param}\s*;\s*\n'
        modified = re.sub(pattern2, '', modified, flags=re.MULTILINE)

        # let param = param; の削除
        pattern3 = rf'^\s*let\s+{param}\s*=\s*{param}\s*;\s*\n'
        modified = re.sub(pattern3, '', modified, flags=re.MULTILINE)

    return modified


def extract_function_params(code: str, function_name: str = 'processRequest') -> List[str]:
    """
    関数の引数リストを抽出

    Args:
        code: コード
        function_name: 関数名

    Returns:
        引数名のリスト
    """
    # function processRequest(param1, param2, ...) の形式を探す
    pattern = rf'function\s+{function_name}\s*\(([^)]+)\)\s*\{{'
    match = re.search(pattern, code)

    if match:
        params_str = match.group(1)
        # カンマで分割して空白を除去
        params = [p.strip() for p in params_str.split(',')]
        # デフォルト値がある場合は削除（例: param = null -> param）
        params = [p.split('=')[0].strip() for p in params]
        return params

    return []


def fix_file(file_path: Path) -> bool:
    """
    ファイルの問題を修正

    Args:
        file_path: 修正するファイル

    Returns:
        変更があった場合True
    """
    # コードを読み込み
    with open(file_path, 'r', encoding='utf-8') as f:
        original_code = f.read()

    # processRequest関数がない場合はスキップ
    if 'function processRequest' not in original_code:
        return False

    # 関数の引数を抽出
    param_names = extract_function_params(original_code)

    if not param_names or param_names == ['params']:
        # 引数がparamsのままの場合はスキップ
        return False

    print(f"\n処理中: {file_path.parts[-3]}/{file_path.name}")
    print(f"  引数: {', '.join(param_names)}")

    # 修正を適用
    modified_code = original_code

    # 重複宣言を削除
    modified_code = fix_duplicate_declarations(modified_code, param_names)

    # 自己代入を削除
    modified_code = fix_self_assignments(modified_code, param_names)

    # 空行が連続する場合は1つにまとめる
    modified_code = re.sub(r'\n\s*\n\s*\n+', '\n\n', modified_code)

    # 変更があった場合のみ書き込み
    if modified_code != original_code:
        # ファイルを書き込み
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(modified_code)

        print(f"  [OK] クリーンアップ完了")
        return True
    else:
        print(f"  [INFO] 変更なし")
        return False


def main():
    """メイン処理"""
    print("=" * 60)
    print("リファクタリング後のコードをクリーンアップ")
    print("=" * 60)

    # 処理対象ファイルを検索
    target_files = []
    for project_dir in GAS_PROJECTS_DIR.iterdir():
        if project_dir.is_dir() and project_dir.name != "共通モジュール":
            scripts_dir = project_dir / "scripts"
            if scripts_dir.exists():
                # すべての.gsファイルを対象とする
                for gs_file in scripts_dir.glob("*.gs"):
                    # バックアップファイルは除外
                    if not str(gs_file).endswith('.backup_individual_params'):
                        target_files.append(gs_file)

    print(f"\n対象ファイル数: {len(target_files)}")

    # 各ファイルを処理
    fixed_count = 0
    for file_path in target_files:
        if fix_file(file_path):
            fixed_count += 1

    print("\n" + "=" * 60)
    print(f"処理結果: {fixed_count}/{len(target_files)} ファイルを修正")

    if fixed_count > 0:
        print("\n[SUCCESS] コードのクリーンアップが完了しました。")


if __name__ == "__main__":
    main()