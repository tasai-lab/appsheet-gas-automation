#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
残りの問題ファイルを手動で修正
"""

from pathlib import Path

# 修正対象ファイルと修正内容
fixes = [
    {
        'file': 'gas_projects/Appsheet_通話_クエリ/scripts/コード.gs',
        'remove_lines': [331, 332, 333, 334, 335, 336],  # if (!e ... } まで
        'description': 'e.postData の検証ブロックを削除'
    },
    {
        'file': 'gas_projects/Appsheet_利用者_フェースシート/scripts/コード.gs',
        'remove_pattern': r'if\s*\(!e\s*\|\|[^}]+\}',
        'description': 'e.postData の検証ブロックを削除'
    }
]

def fix_code_gs():
    """Appsheet_通話_クエリ/scripts/コード.gs を修正"""
    file_path = Path(__file__).parent.parent / 'gas_projects/Appsheet_通話_クエリ/scripts/コード.gs'

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 327行目: log(logCollector, '--- 処理開始 ---');
    # 328: 空行
    # 329: 空行
    # 330: 空行
    # 331: if (!e || !e.postData || !e.postData.contents) {
    # 332: 空行
    # 333: throw new Error('POSTデータが存在しません。');
    # 334: 空行
    # 335: }
    # 336: 空行
    # 337: 空行
    # 338: 空行
    # 339: const keysToTruncate = ...

    # 329-338行目を削除（インデックスは0始まりなので328-337）
    # ただし、329行目の空行は残す

    # 作戦: 330-338行目を削除（インデックス329-337）
    new_lines = lines[:329] + ['\n'] + lines[339:]

    # バックアップ
    backup_path = file_path.with_suffix('.gs.backup3')
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    # 保存
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"[OK] {file_path.name} を修正しました")
    print(f"  削除した行: 330-338 (if (!e ...) ブロック)")

def fix_facesheet_gs():
    """Appsheet_利用者_フェースシート/scripts/コード.gs を修正"""
    file_path = Path(__file__).parent.parent / 'gas_projects/Appsheet_利用者_フェースシート/scripts/コード.gs'

    # まず、processRequest 関数があるかチェック
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'function processRequest(params)' not in content:
        print(f"[SKIP] {file_path.name}: processRequest関数が見つかりません")
        return

    # e.postData の検証ブロックを削除
    import re

    # パターン: if (!e || !e.postData || !e.postData.contents) { ... }
    # 複数行にまたがる可能性がある

    # まず、if行を探す
    lines = content.split('\n')
    new_lines = []
    skip_until_brace = 0

    for line in lines:
        # if (!e || ... postData の行を検出
        if re.search(r'if\s*\(\s*!e\s*\|\|.*postData', line):
            print(f"  [削除] {line.strip()}")
            # このブロックの } まで skip
            skip_until_brace = 1 if '{' in line else 0
            if '}' in line and skip_until_brace > 0:
                skip_until_brace -= 1
            continue

        if skip_until_brace > 0:
            print(f"  [削除] {line.strip()}")
            skip_until_brace += line.count('{') - line.count('}')
            if skip_until_brace <= 0:
                # ブロック終了
                skip_until_brace = 0
            continue

        # JSON.parse(e.postData.contents) の行を検出
        if re.search(r'params\s*=.*JSON\.parse\s*\(\s*e\.postData', line):
            print(f"  [削除] {line.strip()}")
            continue

        new_lines.append(line)

    new_content = '\n'.join(new_lines)

    # バックアップ
    backup_path = file_path.with_suffix('.gs.backup3')
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # 保存
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"[OK] {file_path.name} を修正しました")

def main():
    print("=" * 80)
    print("残りの問題ファイルを手動修正")
    print("=" * 80)

    print("\n[1/2] Appsheet_通話_クエリ/scripts/コード.gs")
    fix_code_gs()

    print("\n[2/2] Appsheet_利用者_フェースシート/scripts/コード.gs")
    fix_facesheet_gs()

    print("\n" + "=" * 80)
    print("修正完了")
    print("=" * 80)

if __name__ == '__main__':
    main()
