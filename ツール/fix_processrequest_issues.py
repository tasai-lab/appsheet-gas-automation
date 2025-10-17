#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
processRequest関数の問題を自動修正するスクリプト
"""

import re
from pathlib import Path

def fix_processrequest_function(file_path):
    """processRequest関数内の問題を修正"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] {file_path} の読み込みエラー: {e}")
        return False

    original_content = content
    modified = False

    # processRequest関数を探す
    pattern = r'function\s+processRequest\s*\(\s*params\s*\)\s*\{'
    match = re.search(pattern, content)

    if not match:
        print(f"[SKIP] {file_path}: processRequest関数が見つかりません")
        return False

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
    new_function_body = function_body

    # Fix 1: params変数の重複宣言を削除
    # パターン: let params = {}; や const params = JSON.parse(...) など
    lines = new_function_body.split('\n')
    fixed_lines = []
    skip_next_empty = False

    for i, line in enumerate(lines):
        # params の重複宣言をチェック
        if re.search(r'^\s*(let|const|var)\s+params\s*[=;]', line):
            print(f"  [FIX] params変数の重複宣言を削除: {line.strip()}")
            modified = True
            skip_next_empty = True
            continue

        # e.postData を含む行をチェック
        if re.search(r'\bparams\s*=\s*.*\be\.postData', line):
            print(f"  [FIX] e.postData への参照を削除: {line.strip()}")
            modified = True
            skip_next_empty = True
            continue

        # if (!e || !e.postData...) ブロックを削除
        if re.search(r'if\s*\(\s*!e\s*\|\|.*postData', line):
            print(f"  [FIX] e への検証ブロックを削除開始")
            # このブロック全体をスキップ (次の } まで)
            depth = line.count('{') - line.count('}')
            if depth > 0:
                # 複数行のifブロック
                j = i + 1
                while j < len(lines) and depth > 0:
                    depth += lines[j].count('{') - lines[j].count('}')
                    j += 1
                # i から j-1 までスキップ
                for k in range(i, min(j, len(lines))):
                    if k == i:
                        lines[k] = '  // [SKIP]'
            modified = True
            skip_next_empty = True
            continue

        # [SKIP] マーカーをスキップ
        if '[SKIP]' in line:
            continue

        # 空行のスキップ処理
        if skip_next_empty and line.strip() == '':
            skip_next_empty = False
            continue

        fixed_lines.append(line)
        skip_next_empty = False

    new_function_body = '\n'.join(fixed_lines)

    # 関数全体を置き換え
    if modified:
        new_content = content[:start_pos] + new_function_body + content[pos-1:]

        # バックアップ
        backup_path = file_path.with_suffix('.gs.backup2')
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_content)

        # 保存
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"[OK] {file_path} を修正しました")
        return True
    else:
        print(f"[SKIP] {file_path}: 修正不要")
        return False

def main():
    """メイン処理"""
    gas_projects_dir = Path(__file__).parent.parent / 'gas_projects'

    # 問題のあるファイルリスト（check_processrequest_issues.py の結果から）
    problematic_files = [
        'Appsheet_通話_要約生成/scripts/core_webhook.gs',
        'Appsheet_通話_クエリ/scripts/main.gs',
        'Appsheet_通話_クエリ/scripts/コード.gs',
        'Appsheet_訪問看護_書類仕分け/scripts/main.gs',
        'Appsheet_営業レポート/scripts/コード.gs',
        'Appsheet_利用者_フェースシート/scripts/コード.gs',
        'Appsheet_ALL_スレッド投稿/scripts/main.gs',
        'Appsheet_ALL_Event/scripts/main.gs',
    ]

    print("=" * 80)
    print("processRequest関数の問題を自動修正")
    print("=" * 80)

    fixed_count = 0
    for rel_path in problematic_files:
        file_path = gas_projects_dir / rel_path
        if file_path.exists():
            print(f"\n処理中: {rel_path}")
            if fix_processrequest_function(file_path):
                fixed_count += 1
        else:
            print(f"[WARN] ファイルが見つかりません: {rel_path}")

    print("\n" + "=" * 80)
    print(f"修正完了: {fixed_count}/{len(problematic_files)} ファイル")
    print("=" * 80)

if __name__ == '__main__':
    main()
