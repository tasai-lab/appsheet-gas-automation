#!/usr/bin/env python3
"""
全プロジェクトのappsscript.jsonにOAuthスコープを追加
"""

import json
from pathlib import Path

# 追加するOAuthスコープ
REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email"
]

# Vertex AI使用プロジェクト用の追加スコープ
VERTEX_AI_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform"
]

# Vertex AI使用プロジェクト名
VERTEX_AI_PROJECTS = [
    'Appsheet_通話_要約生成',
    'Appsheet_利用者_質疑応答'
]

def update_appsscript_json(file_path: Path):
    """appsscript.jsonを更新"""
    with open(file_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # プロジェクト名を取得
    project_name = file_path.parent.parent.name

    # 既存のoauthScopesを取得
    existing_scopes = config.get('oauthScopes', [])

    # 必要なスコープを決定
    required_scopes = REQUIRED_SCOPES.copy()
    if project_name in VERTEX_AI_PROJECTS:
        required_scopes.extend(VERTEX_AI_SCOPES)

    # 新しいスコープを追加（重複を避ける）
    new_scopes = list(dict.fromkeys(existing_scopes + required_scopes))

    # 変更があるか確認
    if set(existing_scopes) == set(new_scopes):
        return False  # 変更なし

    # oauthScopesを更新
    config['oauthScopes'] = new_scopes

    # ファイルに書き込み
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write('\n')

    return True  # 変更あり

def main():
    """メイン処理"""
    print("=" * 70)
    print("  appsscript.jsonにOAuthスコープを追加")
    print("=" * 70)
    print()

    # gas_projectsディレクトリを探索
    gas_projects = Path('gas_projects/projects')

    if not gas_projects.exists():
        print("❌ gas_projects/projectsディレクトリが見つかりません")
        return 1

    # appsscript.jsonファイルを検索
    appsscript_files = list(gas_projects.glob('*/*/scripts/appsscript.json'))

    print(f"📁 {len(appsscript_files)}個のappsscript.jsonを発見")
    print()

    updated_count = 0
    skipped_count = 0

    for file_path in sorted(appsscript_files):
        project_name = file_path.parent.parent.name
        print(f"  処理中: {project_name}")

        try:
            if update_appsscript_json(file_path):
                print(f"    ✓ 更新しました")
                updated_count += 1
            else:
                print(f"    - スキップ（既に設定済み）")
                skipped_count += 1

        except Exception as e:
            print(f"    ✗ エラー: {e}")

    print()
    print("=" * 70)
    print(f"✅ 完了")
    print("=" * 70)
    print(f"  更新: {updated_count}プロジェクト")
    print(f"  スキップ: {skipped_count}プロジェクト")
    print()
    print("次のステップ:")
    print("  1. 各プロジェクトで `clasp push --force` を実行")
    print("  2. GASエディタで再認証（初回実行時のみ）")
    print()

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
