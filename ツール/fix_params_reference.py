#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ExecutionLoggerへのparams参照を修正するスクリプト

個別引数に変更した後、ExecutionLoggerに渡すparamsが未定義になっている問題を修正
"""

import os
import re
from pathlib import Path
from typing import List

# プロジェクトのルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent
GAS_PROJECTS_DIR = PROJECT_ROOT / "gas_projects"


def extract_function_params(code: str, function_name: str = 'processRequest') -> List[str]:
    """
    関数の引数リストを抽出

    Args:
        code: コード
        function_name: 関数名

    Returns:
        引数名のリスト
    """
    pattern = rf'function\s+{function_name}\s*\(([^)]+)\)\s*\{{'
    match = re.search(pattern, code)

    if match:
        params_str = match.group(1)
        params = [p.strip() for p in params_str.split(',')]
        params = [p.split('=')[0].strip() for p in params]
        return params

    return []


def fix_params_reference(code: str, param_names: List[str]) -> str:
    """
    ExecutionLoggerへのparams参照を修正

    Args:
        code: 修正対象のコード
        param_names: 関数の引数名リスト

    Returns:
        修正後のコード
    """
    if not param_names or param_names == ['params']:
        return code

    # ExecutionLoggerの呼び出しを探す
    # ExecutionLogger.xxx(..., params) の形式を探す
    patterns = [
        (r'(ExecutionLogger\.\w+\([^,]+,[^,]+,[^,]+,[^,]+,)\s*params\s*(\))',
         lambda m: f"{m.group(1)} {{ {', '.join([f'{p}: {p}' for p in param_names])} }}{m.group(2)}"),

        # より一般的なパターン（5番目の引数がparams）
        (r'(ExecutionLogger\.\w+\(\s*[^,]+\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*[^,]+\s*,)\s*params\s*(\))',
         lambda m: f"{m.group(1)} {{ {', '.join([f'{p}: {p}' for p in param_names])} }}{m.group(2)}")
    ]

    modified = code
    for pattern, replacement in patterns:
        modified = re.sub(pattern, replacement, modified)

    # params単体の参照も探して修正（主にログ記録部分）
    # ただし、doPost内のparamsは除外
    lines = modified.split('\n')
    in_dopost = False
    result_lines = []

    for line in lines:
        if 'function doPost' in line:
            in_dopost = True
        elif in_dopost and (line.strip() == '}' or 'function ' in line):
            in_dopost = False

        if not in_dopost and 'params' in line and 'ExecutionLogger' in line:
            # ExecutionLoggerの行でparamsを参照している場合
            # params を { param1: param1, param2: param2, ... } に置換
            params_obj = f"{{ {', '.join([f'{p}: {p}' for p in param_names])} }}"
            line = re.sub(r'\bparams\b', params_obj, line)

        result_lines.append(line)

    return '\n'.join(result_lines)


def fix_file(file_path: Path) -> bool:
    """
    ファイルのparams参照を修正

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

    # ExecutionLoggerへのparams参照があるか確認
    if 'ExecutionLogger' not in original_code:
        return False

    print(f"\n処理中: {file_path.parts[-3]}/{file_path.name}")
    print(f"  引数: {', '.join(param_names)}")

    # params参照を修正
    modified_code = fix_params_reference(original_code, param_names)

    # 変更があった場合のみ書き込み
    if modified_code != original_code:
        # ファイルを書き込み
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(modified_code)

        print(f"  [OK] params参照を修正")
        return True
    else:
        print(f"  [INFO] 変更なし")
        return False


def main():
    """メイン処理"""
    print("=" * 60)
    print("ExecutionLoggerへのparams参照を修正")
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
        print("\n[SUCCESS] params参照の修正が完了しました。")


if __name__ == "__main__":
    main()