# Google Apps Script Retriever v2.0

プロフェッショナルなGoogle Apps Script (GAS) プロジェクト管理ツール。Google DriveからGASプロジェクトを取得し、Webhook重複実行防止機能を提供します。

## 🎯 主な機能

- **GASプロジェクトの一括取得**: Google Driveフォルダーから全GASプロジェクトを取得
- **スプレッドシート参照の自動検出**: コード内のスプレッドシートIDを自動抽出
- **Webhook重複防止**: Gemini API使用プロジェクトに重複実行防止機能を自動適用
- **プロフェッショナルな構造**: モジュラー設計で保守性・拡張性に優れる

## 📁 プロジェクト構造

```
all-gas/
├── src/                          # ソースコード
│   ├── config.py                 # 設定管理
│   ├── models/                   # データモデル
│   │   └── gas_project.py        # GASプロジェクト関連モデル
│   ├── services/                 # ビジネスロジック
│   │   ├── auth_service.py       # Google認証
│   │   ├── drive_service.py      # Google Drive API
│   │   ├── script_service.py     # Apps Script API
│   │   ├── sheets_service.py     # Sheets API
│   │   ├── gas_retriever.py      # メイン検索サービス
│   │   ├── project_saver.py      # プロジェクト保存
│   │   ├── project_analyzer.py   # プロジェクト分析
│   │   └── dedup_applicator.py   # 重複防止適用
│   └── utils/                    # ユーティリティ
│       └── file_utils.py         # ファイル操作
├── retrieve_gas.py               # GAS取得CLI
├── apply_dedup.py                # 重複防止適用CLI
├── DuplicationPrevention.gs      # 重複防止ライブラリ
└── gas_projects/                 # 取得したプロジェクト
```

## 🚀 クイックスタート

### 1. インストール

```bash
# 依存パッケージのインストール
pip install -r requirements.txt

# または
python -m pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### 2. Google Cloud設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. 以下のAPIを有効化:
   - Google Drive API
   - Google Apps Script API  
   - Google Sheets API
3. OAuth 2.0認証情報を作成（デスクトップアプリ）
4. `credentials.json` としてダウンロード

### 3. GASプロジェクトを取得

```bash
# 基本的な使用方法
python retrieve_gas.py

# オプション指定
python retrieve_gas.py --folder-id YOUR_FOLDER_ID --filter "appsheet" --verbose

# ヘルプを表示
python retrieve_gas.py --help
```

### 4. 重複防止を適用

```bash
# Gemini API使用プロジェクトに重複防止を適用
python apply_dedup.py

# ドライラン（変更なし）
python apply_dedup.py --dry-run --verbose
```

## 📖 詳細ガイド

### GAS取得コマンド

```bash
python retrieve_gas.py [OPTIONS]

オプション:
  --folder-id ID        Google DriveフォルダーID
  --filter PATTERN      プロジェクト名でフィルタ（デフォルト: appsheet）
  --no-recursive        サブフォルダーを検索しない
  --output-dir DIR      出力ディレクトリ（デフォルト: gas_projects）
  --verbose, -v         詳細ログを表示
  --clear-cache         認証キャッシュをクリア
```

### 重複防止適用コマンド

```bash
python apply_dedup.py [OPTIONS]

オプション:
  --projects-dir DIR    プロジェクトディレクトリ
  --library-file FILE   ライブラリファイルのパス
  --dry-run             変更せずに確認のみ
  --verbose, -v         詳細ログを表示
```

## 🏗️ アーキテクチャ

### レイヤー構造

1. **CLI層** (`retrieve_gas.py`, `apply_dedup.py`)
   - コマンドライン引数の解析
   - ロギング設定
   - エラーハンドリング

2. **サービス層** (`src/services/`)
   - ビジネスロジックの実装
   - 各Google APIサービスのラッパー
   - プロジェクト分析・保存

3. **モデル層** (`src/models/`)
   - データクラス定義
   - ビジネスオブジェクト

4. **ユーティリティ層** (`src/utils/`)
   - ファイル操作
   - テキスト処理
   - 共通機能

### 主要クラス

#### `GASRetriever`
GASプロジェクトの取得を統括するメインサービス

```python
retriever = GASRetriever(auth_service, output_dir)
saved_projects = retriever.retrieve_projects(folder_id, name_filter)
```

#### `ProjectAnalyzer`
プロジェクトを分析し、Gemini APIやWebhookの使用を検出

```python
analyzer = ProjectAnalyzer(projects_dir)
projects_needing_dedup = analyzer.find_projects_needing_dedup()
```

#### `DedupApplicator`
重複防止ライブラリを適用

```python
applicator = DedupApplicator(library_file)
stats = applicator.apply_to_multiple(analyses)
```

## 🔧 カスタマイズ

### 設定変更

`src/config.py` で設定を変更できます：

```python
# Google Cloudプロジェクト
PROJECT_ID = 'your-project-id'

# 検索フィルタ
PROJECT_NAME_FILTER = 'appsheet'

# 出力ディレクトリ
OUTPUT_DIR = Path('gas_projects')

# 正規表現パターン
SPREADSHEET_ID_PATTERNS = [...]
GEMINI_API_PATTERNS = [...]
```

### ロギング

```python
import logging

# ログレベルを設定
logging.basicConfig(level=logging.DEBUG)

# 特定のモジュールのログレベルを変更
logging.getLogger('src.services.drive_service').setLevel(logging.WARNING)
```

## 📊 出力形式

### プロジェクト構造

```
gas_projects/
└── [プロジェクト名]/
    ├── README.md                    # プロジェクト概要
    ├── project_metadata.json        # メタデータ
    ├── appsscript.json              # マニフェスト
    ├── scripts/                     # スクリプトファイル
    │   ├── Code.gs
    │   └── utils_duplicationPrevention.gs  # 重複防止ライブラリ
    ├── spreadsheets/                # スプレッドシートメタデータ
    │   └── [スプレッドシート名]_metadata.json
    └── MIGRATION_GUIDE.md           # 移行ガイド（重複防止適用時）
```

## 🐛 トラブルシューティング

### 認証エラー

```bash
# キャッシュをクリアして再認証
python retrieve_gas.py --clear-cache
```

### フォルダーが見つからない

- 共有ドライブの場合は、アクセス権を確認
- フォルダーIDが正しいか確認
- 認証アカウントでアクセス可能か確認

### APIエラー

```bash
# 詳細ログで原因を調査
python retrieve_gas.py --verbose
```

## 📚 関連ドキュメント

- [DUPLICATION_PREVENTION_GUIDE.md](DUPLICATION_PREVENTION_GUIDE.md) - 重複防止の詳細ガイド
- [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) - 実装レポート
- [SETUP_GUIDE_JP.md](SETUP_GUIDE_JP.md) - セットアップガイド

## 🤝 コントリビューション

バグ報告や機能リクエストは Issues にお願いします。

## 📄 ライセンス

MIT License

## 👤 作成者

Fractal Group

---

**バージョン**: 2.0.0  
**最終更新**: 2025-10-16
