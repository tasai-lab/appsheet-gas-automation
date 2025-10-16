"""
重複防止ライブラリを既存のGASプロジェクトに適用するツール

機能:
1. Gemini APIを使用しているスクリプトを特定
2. doPost/doGet関数を持つスクリプトを特定
3. 重複防止ライブラリを自動で追加
4. 既存コードを重複防止ラッパーで保護
"""

import os
import re
import shutil
from pathlib import Path

# プロジェクトルート
GAS_PROJECTS_DIR = Path('gas_projects')
LIBRARY_FILE = Path('DuplicationPrevention.gs')

def find_gemini_webhook_projects():
    """Gemini APIとWebhookを使用しているプロジェクトを検索"""
    projects = []
    
    for project_dir in GAS_PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
            
        scripts_dir = project_dir / 'scripts'
        if not scripts_dir.exists():
            continue
        
        has_gemini = False
        has_webhook = False
        dopost_file = None
        
        for script_file in scripts_dir.glob('*.gs'):
            content = script_file.read_text(encoding='utf-8', errors='ignore')
            
            # Gemini API使用チェック
            if re.search(r'gemini|generativelanguage\.googleapis\.com|generateContent', content, re.IGNORECASE):
                has_gemini = True
            
            # Webhook（doPost/doGet）チェック
            if re.search(r'function\s+doPost\s*\(', content):
                has_webhook = True
                dopost_file = script_file
            elif re.search(r'function\s+doGet\s*\(', content):
                has_webhook = True
                dopost_file = script_file
        
        if has_gemini and has_webhook:
            projects.append({
                'name': project_dir.name,
                'path': project_dir,
                'scripts_dir': scripts_dir,
                'webhook_file': dopost_file
            })
    
    return projects

def check_if_already_protected(script_file):
    """既に重複防止が実装されているかチェック"""
    content = script_file.read_text(encoding='utf-8', errors='ignore')
    
    patterns = [
        r'executeWebhookWithDuplicationPrevention',
        r'checkDuplicateRequest',
        r'markAsProcessingWithLock',
        r'isDuplicateRequest.*markAsProcessing'
    ]
    
    for pattern in patterns:
        if re.search(pattern, content):
            return True
    
    return False

def add_library_to_project(project_info):
    """プロジェクトに重複防止ライブラリを追加"""
    scripts_dir = project_info['scripts_dir']
    dest_file = scripts_dir / 'utils_duplicationPrevention.gs'
    
    # 既に存在する場合はスキップ
    if dest_file.exists():
        print(f"  ⚠️ ライブラリファイルは既に存在します: {dest_file.name}")
        return False
    
    # ライブラリファイルをコピー
    shutil.copy(LIBRARY_FILE, dest_file)
    print(f"  ✅ ライブラリを追加: {dest_file.name}")
    return True

def create_backup(script_file):
    """バックアップファイルを作成"""
    backup_file = script_file.with_suffix('.gs.backup')
    shutil.copy(script_file, backup_file)
    print(f"  💾 バックアップ作成: {backup_file.name}")
    return backup_file

def analyze_dopost_function(script_file):
    """doPost関数を解析してレコードIDフィールドを特定"""
    content = script_file.read_text(encoding='utf-8', errors='ignore')
    
    # レコードIDフィールド候補を探す
    id_field_patterns = [
        r'params\.(\w*[Ii]d)',
        r'data\.(\w*[Ii]d)',
        r'callId',
        r'recordId',
        r'recordNoteId',
        r'documentId',
        r'fileId'
    ]
    
    id_fields = set()
    for pattern in id_field_patterns:
        matches = re.findall(pattern, content)
        id_fields.update(matches)
    
    # 最も可能性の高いフィールドを推定
    priority_fields = ['callId', 'recordId', 'recordNoteId', 'documentId']
    for field in priority_fields:
        if field in id_fields:
            return field
    
    # 見つからない場合はデフォルト
    return 'recordId' if id_fields else None

def generate_migration_guide(project_info, record_id_field):
    """移行ガイドを生成"""
    guide = f"""
# {project_info['name']} - 重複防止実装ガイド

## 自動検出情報
- Webhook ファイル: {project_info['webhook_file'].name}
- 推定レコードIDフィールド: {record_id_field or '不明（手動確認が必要）'}

## 実装手順

### 1. ライブラリの追加
✅ 完了: `utils_duplicationPrevention.gs` が追加されました

### 2. doPost関数の修正

#### 修正前のコード:
```javascript
function doPost(e) {{
  try {{
    const params = JSON.parse(e.postData.contents);
    // 処理...
  }} catch (error) {{
    // エラー処理...
  }}
}}
```

#### 修正後のコード（推奨）:
```javascript
function doPost(e) {{
  return executeWebhookWithDuplicationPrevention(e, processWebhook, {{
    recordIdField: '{record_id_field or 'recordId'}',
    enableFingerprint: true
  }});
}}

function processWebhook(params) {{
  // 既存の処理ロジックをここに移動
  const {record_id_field or 'recordId'} = params.{record_id_field or 'recordId'};
  
  // Gemini API呼び出しなどの処理...
  
  return {{
    success: true,
    {record_id_field or 'recordId'}: {record_id_field or 'recordId'}
  }};
}}
```

### 3. テスト方法

1. Apps Scriptエディタでコードを保存
2. Webアプリとして再デプロイ
3. 同じリクエストを複数回送信してテスト
4. ログで重複検知を確認:
   ```
   🔒 重複検知: xxx - 状態: processing
   ```

### 4. 確認事項

- [ ] レコードIDフィールド名が正しいか確認
- [ ] Gemini API呼び出しが1回のみか確認  
- [ ] エラー時のリトライが動作するか確認
- [ ] ログに重複防止メッセージが出力されるか確認

## 詳細ドキュメント

`DUPLICATION_PREVENTION_GUIDE.md` を参照してください。
"""
    
    guide_file = project_info['path'] / 'MIGRATION_GUIDE.md'
    guide_file.write_text(guide, encoding='utf-8')
    print(f"  📄 移行ガイド作成: {guide_file.name}")

def main():
    print("="*60)
    print("Webhook重複防止ライブラリ適用ツール")
    print("="*60)
    print()
    
    if not LIBRARY_FILE.exists():
        print(f"❌ ライブラリファイルが見つかりません: {LIBRARY_FILE}")
        return
    
    # Gemini APIとWebhookを使用しているプロジェクトを検索
    print("📊 Gemini API + Webhook使用プロジェクトを検索中...")
    projects = find_gemini_webhook_projects()
    
    print(f"\n見つかったプロジェクト: {len(projects)}件\n")
    
    if not projects:
        print("該当するプロジェクトが見つかりませんでした。")
        return
    
    # 各プロジェクトに適用
    applied_count = 0
    skipped_count = 0
    
    for i, project in enumerate(projects, 1):
        print(f"[{i}/{len(projects)}] {project['name']}")
        
        # 既に保護されているかチェック
        if project['webhook_file'] and check_if_already_protected(project['webhook_file']):
            print(f"  ✅ 既に重複防止が実装されています")
            skipped_count += 1
            print()
            continue
        
        # ライブラリを追加
        add_library_to_project(project)
        
        # レコードIDフィールドを解析
        record_id_field = None
        if project['webhook_file']:
            record_id_field = analyze_dopost_function(project['webhook_file'])
            print(f"  🔍 推定レコードIDフィールド: {record_id_field or '不明'}")
        
        # 移行ガイドを生成
        generate_migration_guide(project, record_id_field)
        
        applied_count += 1
        print()
    
    # サマリー
    print("="*60)
    print(f"✅ 適用完了: {applied_count}件")
    print(f"⏭️  スキップ: {skipped_count}件（既に実装済み）")
    print("="*60)
    print()
    print("次のステップ:")
    print("1. 各プロジェクトの MIGRATION_GUIDE.md を確認")
    print("2. doPost関数を推奨パターンに修正")
    print("3. Apps Scriptエディタでテスト")
    print("4. 本番環境にデプロイ")
    print()
    print("詳細: DUPLICATION_PREVENTION_GUIDE.md を参照")

if __name__ == '__main__':
    main()
