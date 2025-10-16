"""
Generate documentation for all Appsheet GAS projects
Creates README, specifications, and flow diagrams
"""

import os
import json
from pathlib import Path

# Documentation templates

def create_readme(project_name, metadata, has_gemini=False):
    """Create README.md for a project"""
    
    script_id = metadata.get('id', 'N/A')
    created = metadata.get('createdTime', 'N/A')
    modified = metadata.get('modifiedTime', 'N/A')
    
    # Categorize by name
    category = "その他"
    if "通話" in project_name:
        category = "通話関連"
    elif "訪問看護" in project_name:
        category = "訪問看護"
    elif "営業" in project_name:
        category = "営業"
    elif "利用者" in project_name:
        category = "利用者管理"
    elif "ALL" in project_name or "All" in project_name:
        category = "共通機能"
    
    model_info = ""
    if has_gemini:
        if any(k in project_name for k in ["要約", "記録", "質疑応答", "レポート", "OCR", "問題点", "評価", "フェースシート"]):
            model_info = """
## 使用モデル

- **Gemini Model**: gemini-1.5-pro-latest
- **用途**: 複雑な推論と分析が必要なタスク
- **API Key**: AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY
"""
        else:
            model_info = """
## 使用モデル

- **Gemini Model**: gemini-2.0-flash-exp
- **用途**: 高速処理が求められるタスク
- **API Key**: AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY
"""
    
    return f"""# {project_name}

## 概要

**カテゴリ**: {category}

このプロジェクトは、AppSheetからのWebhookリクエストを処理し、Google Apps Scriptで自動化されたワークフローを実行します。

## プロジェクト情報

- **Script ID**: `{script_id}`
- **作成日時**: {created}
- **最終更新**: {modified}
{model_info}
## 主要機能

1. **Webhook受信**: AppSheetからのPOSTリクエストを受信
2. **重複実行防止**: SHA-256ハッシュベースの重複チェックとロック機構
3. **実行ログ記録**: すべての実行結果をスプレッドシートに記録
4. **エラーハンドリング**: 包括的なエラー処理と詳細なログ記録

## ディレクトリ構造

```
{project_name}/
├── README.md                  # このファイル
├── SPECIFICATIONS.md          # 詳細仕様書
├── FLOW.md                    # フローチャートとシーケンス図
├── scripts/                   # GASスクリプトファイル
│   ├── *.gs                  # Google Apps Scriptファイル
├── spreadsheets/              # 参照スプレッドシートメタデータ
└── project_metadata.json      # プロジェクトメタデータ
```

## セットアップ

### 必要な権限

- Google Drive API
- Google Sheets API  
- Google Calendar API (該当する場合)
- Chat API (該当する場合)

### 環境設定

1. スクリプトプロパティに以下を設定:
   - 必要に応じてAPI Keyやその他の設定値

2. 実行ログスプレッドシート:
   - ID: `15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE`
   - すべての実行ログがここに記録されます

## デプロイ

### Webアプリとしてデプロイ

1. Apps Script エディタを開く
2. 「デプロイ」→「新しいデプロイ」を選択
3. 種類: 「ウェブアプリ」
4. 実行者: 「自分」
5. アクセスできるユーザー: 「全員」
6. デプロイ

### Webhook URL

デプロイ後、生成されたWebアプリURLをAppSheetのWorkflowに設定します。

## 使用方法

AppSheetから自動的にWebhookがトリガーされます。手動テストの場合:

```javascript
// Test function (if implemented in the script)
function test() {{
  // Call doPost with test data
}}
```

## トラブルシューティング

### ログの確認

実行ログスプレッドシートを確認:
- URL: https://docs.google.com/spreadsheets/d/15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE

### よくある問題

1. **重複実行**: キャッシュとロックで自動的に防止されます
2. **タイムアウト**: 長時間処理はバックグラウンド実行を検討
3. **権限エラー**: 必要な権限が付与されているか確認

## 更新履歴

### 最新版 (2025-10-16)
- ✅ 重複実行防止機能の実装
- ✅ 統合ログシステムの導入
- ✅ Gemini APIキーの統一化
- ✅ モデル選択の最適化
- ✅ メール通知の削除（ログに統合）

## 関連ドキュメント

- [詳細仕様書](./SPECIFICATIONS.md)
- [フローチャート](./FLOW.md)
- [実行ログスプレッドシート](https://docs.google.com/spreadsheets/d/15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## サポート

問題が発生した場合は、実行ログを確認するか、開発チームにお問い合わせください。
"""


def create_specifications(project_name, scripts_content):
    """Create detailed specifications"""
    
    functions = []
    for script_path, content in scripts_content.items():
        # Extract function signatures
        import re
        func_pattern = r'function\s+(\w+)\s*\([^)]*\)\s*{'
        matches = re.findall(func_pattern, content)
        for func_name in matches:
            if not func_name.startswith('_'):  # Skip private functions
                functions.append((script_path.stem, func_name))
    
    functions_list = "\n".join([f"- `{fname}` ({script})" for script, fname in functions])
    
    return f"""# {project_name} - 詳細仕様書

## 目的

このスクリプトは、AppSheetアプリケーションと連携し、データ処理、API呼び出し、スプレッドシート操作などの自動化タスクを実行します。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース
   - 重複チェックを実行

2. **重複防止モジュール** (`DuplicationPrevention`)
   - SHA-256ハッシュによるリクエスト識別
   - ScriptCacheによる処理済みマーク
   - LockServiceによる排他制御

3. **実行ログモジュール** (`ExecutionLogger`)
   - すべての処理結果を記録
   - タイムスタンプ、ステータス、エラー詳細を保存
   - スプレッドシートに集約

4. **ビジネスロジック**
   - プロジェクト固有の処理
   - 外部API呼び出し（Gemini APIなど）
   - データ変換と保存

## 関数一覧

{functions_list}

## データフロー

```
AppSheet Webhook
    ↓
doPost(e)
    ↓
重複チェック (DuplicationPrevention)
    ↓
処理実行 (ビジネスロジック)
    ↓
結果記録 (ExecutionLogger)
    ↓
レスポンス返却
```

## エラーハンドリング

### エラーレベル

1. **SUCCESS**: 正常終了
2. **WARNING**: 警告（重複リクエストなど）
3. **ERROR**: エラー発生

### エラー記録

すべてのエラーは実行ログスプレッドシートに記録されます:
- エラーメッセージ
- スタックトレース
- 入力データ
- 実行時間

## パフォーマンス考慮事項

### キャッシュ戦略

- **有効期限**: 1時間 (3600秒)
- **用途**: 重複リクエストの検出

### ロック戦略

- **タイムアウト**: 5分 (300,000ミリ秒)
- **スコープ**: スクリプトレベル

## セキュリティ

### 認証

- AppSheet Webhookからのリクエストは認証不要（公開URL）
- 必要に応じてシークレットトークンによる検証を追加可能

### データ保護

- APIキーはスクリプトプロパティで管理（推奨）
- 実行ログには機密情報を含めない

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### 推奨事項

- 大量データ処理は分割実行
- タイムアウト対策としてバックグラウンド処理を検討

## テスト

### 単体テスト

```javascript
function testDoPost() {{
  const testData = {{
    postData: {{
      contents: JSON.stringify({{
        // Test data here
      }})
    }}
  }};
  
  const result = doPost(testData);
  Logger.log(result);
}}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に実行ログスプレッドシートを確認:
- エラー率
- 実行時間の傾向
- 重複リクエストの頻度

### アップデート手順

1. スクリプトを更新
2. バージョン作成
3. デプロイメント更新
4. テスト実行
5. ログで動作確認

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| 実行ログスプレッドシートID | 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE |
| キャッシュ有効期限 | 3600秒 |
| ロックタイムアウト | 300000ミリ秒 |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
"""


def create_flow_diagrams(project_name):
    """Create flow diagrams with Mermaid"""
    
    return f"""# {project_name} - フロー図

## システムフロー図

### メイン処理フロー

```mermaid
flowchart TD
    A[AppSheet Webhook] -->|POST Request| B[doPost]
    B --> C{{JSONパース}}
    C -->|成功| D[リクエストID生成]
    C -->|失敗| E[エラーログ記録]
    E --> F[エラーレスポンス返却]
    
    D --> G{{重複チェック}}
    G -->|重複あり| H[警告ログ記録]
    H --> I[スキップレスポンス返却]
    
    G -->|重複なし| J[キャッシュに処理済みマーク]
    J --> K[ビジネスロジック実行]
    
    K -->|成功| L[成功ログ記録]
    K -->|エラー| M[エラーログ記録]
    
    L --> N[成功レスポンス返却]
    M --> F
```

## 重複防止フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant GAS as GAS Script
    participant Cache as ScriptCache
    participant Lock as LockService
    participant Log as 実行ログ
    
    AS->>GAS: POST Request
    GAS->>GAS: リクエストデータからハッシュ生成
    GAS->>Cache: キャッシュ確認
    
    alt キャッシュにあり
        Cache-->>GAS: 処理済み
        GAS->>Log: 警告ログ記録
        GAS-->>AS: スキップレスポンス
    else キャッシュになし
        Cache-->>GAS: 未処理
        GAS->>Lock: ロック取得
        Lock-->>GAS: ロック成功
        GAS->>Cache: 再度確認（ダブルチェック）
        
        alt 再確認で処理済み
            Cache-->>GAS: 処理済み
            GAS->>Lock: ロック解放
            GAS->>Log: 警告ログ記録
            GAS-->>AS: スキップレスポンス
        else 再確認で未処理
            Cache-->>GAS: 未処理
            GAS->>Cache: 処理済みマーク設定
            GAS->>GAS: ビジネスロジック実行
            GAS->>Log: 成功/エラーログ記録
            GAS->>Lock: ロック解放
            GAS-->>AS: 処理結果レスポンス
        end
    end
```

## データフロー図

```mermaid
flowchart LR
    A[Webhook Data] --> B[JSON Parse]
    B --> C[Data Validation]
    C --> D[Data Transformation]
    D --> E{{処理タイプ}}
    
    E -->|Gemini API| F[AI Processing]
    E -->|Spreadsheet| G[Sheet Operations]
    E -->|Calendar| H[Calendar Events]
    E -->|Chat| I[Chat Messages]
    
    F --> J[Results]
    G --> J
    H --> J
    I --> J
    
    J --> K[Log Recording]
    K --> L[Response Generation]
```

## エラーハンドリングフロー

```mermaid
flowchart TD
    A[処理開始] --> B[Try Block]
    B --> C{{エラー発生?}}
    
    C -->|なし| D[正常処理完了]
    D --> E[成功ログ記録]
    E --> F[実行時間記録]
    F --> G[成功レスポンス]
    
    C -->|あり| H[Catch Block]
    H --> I[エラー情報取得]
    I --> J[スタックトレース取得]
    J --> K[エラーログ記録]
    K --> L[実行時間記録]
    L --> M[エラーレスポンス]
    
    G --> N[処理終了]
    M --> N
```

## ログ記録フロー

```mermaid
sequenceDiagram
    participant Script as GAS Script
    participant Logger as ExecutionLogger
    participant Sheet as Log Spreadsheet
    
    Script->>Logger: log() 呼び出し
    Logger->>Logger: タイムスタンプ生成
    Logger->>Logger: ユーザー情報取得
    Logger->>Logger: データフォーマット
    
    Logger->>Sheet: スプレッドシート取得
    Sheet-->>Logger: シート参照
    
    Logger->>Sheet: 行追加
    Sheet-->>Logger: 追加完了
    
    alt ログ記録成功
        Logger-->>Script: 成功
    else ログ記録失敗
        Logger->>Logger: コンソールログ出力
        Logger-->>Script: 無視（処理継続）
    end
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Idle: システム待機
    Idle --> Receiving: Webhook受信
    Receiving --> Validating: データ検証
    
    Validating --> Error: 検証失敗
    Validating --> Checking: 検証成功
    
    Checking --> Duplicate: 重複検出
    Checking --> Processing: 新規リクエスト
    
    Duplicate --> Logging: 警告ログ
    Processing --> Executing: ビジネスロジック
    
    Executing --> Success: 処理成功
    Executing --> Error: 処理失敗
    
    Success --> Logging
    Error --> Logging
    
    Logging --> Responding: レスポンス生成
    Responding --> [*]: 処理完了
```

## タイミング図

```mermaid
gantt
    title 処理タイミング
    dateFormat  HH:mm:ss.SSS
    axisFormat  %S.%L秒
    
    section リクエスト受信
    Webhook受信           :a1, 00:00:00.000, 10ms
    JSONパース            :a2, after a1, 20ms
    
    section 重複チェック
    ハッシュ生成          :b1, after a2, 30ms
    キャッシュ確認        :b2, after b1, 50ms
    ロック取得            :b3, after b2, 100ms
    
    section ビジネスロジック
    データ処理            :c1, after b3, 500ms
    API呼び出し           :c2, after c1, 2000ms
    結果保存              :c3, after c2, 300ms
    
    section ログ記録
    ログ記録              :d1, after c3, 100ms
    
    section レスポンス
    レスポンス生成        :e1, after d1, 50ms
```

## コンポーネント図

```mermaid
graph TB
    subgraph "AppSheet"
        A[Workflow]
    end
    
    subgraph "Google Apps Script"
        B[doPost Handler]
        C[DuplicationPrevention]
        D[ExecutionLogger]
        E[Business Logic]
    end
    
    subgraph "Google Services"
        F[ScriptCache]
        G[LockService]
        H[SpreadsheetApp]
        I[DriveApp]
    end
    
    subgraph "External APIs"
        J[Gemini API]
    end
    
    A -->|Webhook| B
    B --> C
    B --> E
    E --> D
    
    C --> F
    C --> G
    D --> H
    E --> I
    E --> J
```

## 使用例

### 正常フロー

1. AppSheetからWebhook送信
2. doPost関数でリクエスト受信
3. 重複チェック（初回なのでパス）
4. ビジネスロジック実行
5. 成功ログ記録
6. 成功レスポンス返却

### 重複検出フロー

1. AppSheetから同じリクエストを2回送信
2. 1回目: 正常処理
3. 2回目: キャッシュで重複検出
4. 警告ログ記録
5. スキップレスポンス返却

### エラーフロー

1. AppSheetからWebhook送信
2. ビジネスロジック実行中にエラー
3. Catchブロックでエラー捕捉
4. エラーログ記録（詳細とスタックトレース）
5. エラーレスポンス返却
"""


def generate_documentation_for_project(project_dir):
    """Generate all documentation for a single project"""
    project_name = project_dir.name
    print(f"  Generating docs for: {project_name}")
    
    # Load metadata
    metadata_file = project_dir / 'project_metadata.json'
    if not metadata_file.exists():
        print(f"    ✗ No metadata found")
        return False
    
    with open(metadata_file, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    # Load scripts content
    scripts_dir = project_dir / 'scripts'
    scripts_content = {}
    has_gemini = False
    
    if scripts_dir.exists():
        for gs_file in scripts_dir.glob('*.gs'):
            with open(gs_file, 'r', encoding='utf-8') as f:
                content = f.read()
                scripts_content[gs_file] = content
                if 'gemini' in content.lower():
                    has_gemini = True
    
    # Generate README
    readme_path = project_dir / 'README.md'
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(create_readme(project_name, metadata, has_gemini))
    print(f"    ✓ README.md")
    
    # Generate SPECIFICATIONS
    specs_path = project_dir / 'SPECIFICATIONS.md'
    with open(specs_path, 'w', encoding='utf-8') as f:
        f.write(create_specifications(project_name, scripts_content))
    print(f"    ✓ SPECIFICATIONS.md")
    
    # Generate FLOW diagrams
    flow_path = project_dir / 'FLOW.md'
    with open(flow_path, 'w', encoding='utf-8') as f:
        f.write(create_flow_diagrams(project_name))
    print(f"    ✓ FLOW.md")
    
    return True


def main():
    print("=" * 70)
    print("Generate Documentation for All Appsheet Projects")
    print("=" * 70)
    
    gas_projects_dir = Path('gas_projects')
    
    if not gas_projects_dir.exists():
        print("✗ gas_projects directory not found")
        return
    
    # Get all Appsheet projects
    projects = [d for d in gas_projects_dir.iterdir() 
                if d.is_dir() and 'appsheet' in d.name.lower()]
    
    total = len(projects)
    success_count = 0
    
    for idx, project_dir in enumerate(sorted(projects), 1):
        print(f"\n[{idx}/{total}] {project_dir.name}")
        if generate_documentation_for_project(project_dir):
            success_count += 1
    
    print("\n" + "=" * 70)
    print(f"✓ Documentation generation complete!")
    print(f"  Total projects: {total}")
    print(f"  Successful: {success_count}")
    print(f"  Failed: {total - success_count}")
    print("=" * 70)


if __name__ == '__main__':
    main()
