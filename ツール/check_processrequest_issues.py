#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
processRequest関数の問題を検出するスクリプト
"""

import re
from pathlib import Path

def check_processrequest_function(file_path):
    """processRequest関数内の問題を検出"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return None

    # processRequest関数を探す
    pattern = r'function\s+processRequest\s*\(\s*params\s*\)\s*\{'
    match = re.search(pattern, content)

    if not match:
        return None

    # 関数の本体を抽出
    start_pos = match.end()
    brace_count = 1
    pos = start_pos

    while pos < len(content) and brace_count > 0:
        if content[pos] == '{':
            brace_count += 1
        elif content[pos] == '}':
            brace_count -= 1
        pos += 1

    function_body = content[start_pos:pos-1]

    issues = []

    # Issue 1: params の重複宣言
    if re.search(r'\b(let|const|var)\s+params\s*[=;]', function_body):
        issues.append("params変数の重複宣言")

    # Issue 2: e.postData への参照
    if re.search(r'\be\.postData', function_body):
        issues.append("未定義の変数 'e' への参照")

    # Issue 3: JSON.parse(e.postData.contents)
    if re.search(r'JSON\.parse\s*\(\s*e\.postData', function_body):
        issues.append("e.postData.contents の使用")

    return issues if issues else None

def main():
    """メイン処理"""
    gas_projects_dir = Path(__file__).parent.parent / 'gas_projects'

    # すべての.gsファイルをチェック
    problematic_files = []

    for gs_file in gas_projects_dir.rglob('*.gs'):
        issues = check_processrequest_function(gs_file)
        if issues:
            problematic_files.append((gs_file, issues))

    # 結果を表示
    print("=" * 80)
    print("processRequest関数の問題検出結果")
    print("=" * 80)

    if not problematic_files:
        print("\n[OK] 問題は見つかりませんでした。")
    else:
        print(f"\n[WARN] {len(problematic_files)}個のファイルに問題が見つかりました:\n")

        for file_path, issues in problematic_files:
            rel_path = file_path.relative_to(gas_projects_dir.parent)
            print(f"\n{rel_path}")
            for issue in issues:
                print(f"  - {issue}")

    print("\n" + "=" * 80)

    return problematic_files

if __name__ == '__main__':
    problematic_files = main()
    if problematic_files:
        exit(1)
