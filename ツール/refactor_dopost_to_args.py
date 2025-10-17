#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASスクリプトのdoPost関数を引数ベース関数に分離するツール

使用方法:
    python refactor_dopost_to_args.py [--projects-dir DIR] [--filter PATTERN] [--dry-run]

機能:
1. doPost(e) 関数を維持（AppSheet互換性）
2. 内部処理を processRequest(params) 関数に抽出
3. testProcessRequest() テスト関数を追加
4. 既存のdoPost内のロジックを新しい関数に移動
"""

import os
import re
import argparse
import shutil
from pathlib import Path

# デフォルト設定
DEFAULT_PROJECTS_DIR = 'gas_projects'


def parse_arguments():
    """引数をパース"""
    parser = argparse.ArgumentParser(
        description='doPost関数を引数ベース関数に分離',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--projects-dir',
        type=Path,
        default=Path(DEFAULT_PROJECTS_DIR),
        help=f'GASプロジェクトディレクトリ (デフォルト: {DEFAULT_PROJECTS_DIR})'
    )

    parser.add_argument(
        '--filter',
        help='プロジェクト名フィルター（部分一致）'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='実際の変更を行わず、実行内容を表示'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='詳細ログを表示'
    )

    parser.add_argument(
        '--backup',
        action='store_true',
        default=True,
        help='変更前にバックアップを作成（デフォルト: True）'
    )

    return parser.parse_args()


def find_dopost_function(content):
    """doPost関数を検索して抽出"""
    # doPost関数全体を抽出するパターン
    pattern = r'(function\s+doPost\s*\([^)]*\)\s*\{)'

    match = re.search(pattern, content)
    if not match:
        return None, None

    start_pos = match.start()
    func_start = match.group(1)

    # 関数本体を抽出（ブレースのバランスを考慮）
    brace_count = 1
    pos = match.end()

    while pos < len(content) and brace_count > 0:
        if content[pos] == '{':
            brace_count += 1
        elif content[pos] == '}':
            brace_count -= 1
        pos += 1

    if brace_count != 0:
        return None, None  # バランスが取れていない

    end_pos = pos
    function_body = content[start_pos:end_pos]

    return function_body, (start_pos, end_pos)


def extract_dopost_body(dopost_function):
    """doPost関数本体から処理ロジックを抽出"""
    # function doPost(e) { ... } から本体部分を抽出
    match = re.search(r'function\s+doPost\s*\([^)]*\)\s*\{(.*)\}', dopost_function, re.DOTALL)
    if not match:
        return None

    body = match.group(1).strip()
    return body


def create_refactored_code(original_dopost, body, script_name):
    """リファクタリング後のコードを生成"""

    # paramsの取得部分を検出
    params_pattern = r'(const|let|var)\s+params\s*=\s*JSON\.parse\(e\.postData\.contents\);?'
    has_params_parse = re.search(params_pattern, body)

    # paramsの取得部分を除去
    body_without_params = re.sub(params_pattern, '', body).strip()

    # 新しいdoPost（シンプル版）
    new_dopost = '''/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}
'''

    # 新しいprocessRequest関数
    process_request = f'''/**
 * メイン処理関数（引数ベース）
 * @param {{Object}} params - リクエストパラメータ
 * @returns {{Object}} - 処理結果
 */
function processRequest(params) {{
  {body_without_params}
}}
'''

    # テスト関数
    test_function = f'''/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {{
  // TODO: テストデータを設定してください
  const testParams = {{
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  }};

  console.log('=== テスト実行: {script_name} ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {{
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  }} catch (error) {{
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }}
}}
'''

    refactored = f'''{new_dopost}

{process_request}

{test_function}'''

    return refactored


def refactor_file(file_path, script_name, args):
    """単一のGSファイルをリファクタリング"""

    if args.verbose:
        print(f"  処理中: {file_path.name}")

    # ファイル読み込み
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # doPost関数を検索
    dopost_function, positions = find_dopost_function(content)

    if not dopost_function:
        if args.verbose:
            print(f"    [INFO] doPost関数が見つかりません")
        return False

    # 既にリファクタリング済みかチェック
    if 'function processRequest' in content:
        if args.verbose:
            print(f"    [INFO] 既にリファクタリング済み")
        return False

    # doPost本体を抽出
    body = extract_dopost_body(dopost_function)
    if not body:
        print(f"    [ERROR] doPost本体の抽出に失敗")
        return False

    # リファクタリング後のコードを生成
    refactored_code = create_refactored_code(dopost_function, body, script_name)

    # doPost関数を置き換え
    start_pos, end_pos = positions
    new_content = content[:start_pos] + refactored_code + content[end_pos:]

    if args.dry_run:
        print(f"    [DRY-RUN] 変更内容:")
        print(f"    - doPost関数を分離")
        print(f"    - processRequest関数を追加")
        print(f"    - testProcessRequest関数を追加")
        return True

    # バックアップ作成
    if args.backup:
        backup_path = file_path.with_suffix('.gs.backup')
        shutil.copy2(file_path, backup_path)
        if args.verbose:
            print(f"    [BACKUP] {backup_path.name}")

    # ファイル書き込み
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"    [OK] リファクタリング完了")
    return True


def refactor_project(project_dir, args):
    """プロジェクト内の全GSファイルをリファクタリング"""
    project_name = project_dir.name
    print(f"\n[{project_name}]")

    scripts_dir = project_dir / 'scripts'
    if not scripts_dir.exists():
        print(f"  [INFO] scriptsディレクトリが見つかりません")
        return 0

    refactored_count = 0

    for gs_file in scripts_dir.glob('*.gs'):
        # ExecutionLogger.gsなど、システムファイルはスキップ
        if gs_file.name in ['ExecutionLogger.gs', 'utils_duplicationPrevention.gs']:
            if args.verbose:
                print(f"  [SKIP] {gs_file.name}")
            continue

        if refactor_file(gs_file, project_name, args):
            refactored_count += 1

    return refactored_count


def main():
    """メイン処理"""
    args = parse_arguments()

    print("=" * 70)
    print("doPost関数リファクタリングツール")
    print("=" * 70)
    print(f"プロジェクトディレクトリ: {args.projects_dir}")
    if args.filter:
        print(f"フィルター: {args.filter}")
    if args.dry_run:
        print("モード: DRY-RUN（実際の変更は行いません）")
    print("=" * 70)

    if not args.projects_dir.exists():
        print(f"[ERROR] ディレクトリが見つかりません: {args.projects_dir}")
        return

    # プロジェクトを取得
    projects = [d for d in args.projects_dir.iterdir()
                if d.is_dir() and 'appsheet' in d.name.lower()]

    # フィルター適用
    if args.filter:
        projects = [d for d in projects if args.filter in d.name]

    if not projects:
        print("対象プロジェクトが見つかりませんでした")
        return

    total_refactored = 0

    for idx, project_dir in enumerate(sorted(projects), 1):
        print(f"\n[{idx}/{len(projects)}]", end=' ')
        count = refactor_project(project_dir, args)
        total_refactored += count

    print("\n" + "=" * 70)
    print(f"[COMPLETE] リファクタリング完了")
    print(f"  対象プロジェクト: {len(projects)}")
    print(f"  リファクタリング済みファイル: {total_refactored}")
    print("=" * 70)

    if not args.dry_run and total_refactored > 0:
        print("\n次のステップ:")
        print("1. GASエディタで各プロジェクトを開く")
        print("2. testProcessRequest() 関数を実行してテスト")
        print("3. テストデータを実際のデータに合わせて修正")
        print("4. 動作確認後、本番環境にデプロイ")


if __name__ == '__main__':
    main()
