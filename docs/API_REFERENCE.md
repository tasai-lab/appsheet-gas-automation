# API リファレンス

## 概要

このドキュメントは、GAS Retriever v2.0 の主要なAPI（クラス、メソッド、関数）の完全なリファレンスです。

## 目次

- [認証](#認証)
- [Drive操作](#drive操作)
- [Script操作](#script操作)
- [Sheets操作](#sheets操作)
- [プロジェクト管理](#プロジェクト管理)
- [ユーティリティ](#ユーティリティ)

---

## 認証

### AuthService

```python
from src.services import AuthService
```

#### コンストラクタ

```python
AuthService(
    credentials_file: Path,
    token_file: Path,
    scopes: List[str],
    project_id: Optional[str] = None
)
```

**パラメータ**:
- `credentials_file`: OAuth 2.0認証情報ファイルパス
- `token_file`: トークンキャッシュファイルパス
- `scopes`: 必要な権限スコープ
- `project_id`: Google Cloud プロジェクトID（オプション）

**例**:
```python
auth = AuthService(
    credentials_file=Path('credentials.json'),
    token_file=Path('token.pickle'),
    scopes=[
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/script.projects.readonly'
    ],
    project_id='my-project-id'
)
```

#### メソッド

##### `get_credentials() -> Credentials`

有効な認証情報を取得。キャッシュがない場合は認証フローを実行。

**戻り値**: `google.oauth2.credentials.Credentials`

**例外**:
- `FileNotFoundError`: credentials.jsonが見つからない
- `Exception`: 認証失敗

**例**:
```python
creds = auth.get_credentials()
```

##### `clear_cache() -> None`

認証キャッシュをクリア。次回`get_credentials()`で再認証。

**例**:
```python
auth.clear_cache()
```

---

## Drive操作

### DriveService

```python
from src.services import DriveService
```

#### コンストラクタ

```python
DriveService(credentials: Credentials)
```

#### メソッド

##### `list_gas_files_in_folder(folder_id: str, name_filter: Optional[str] = None, recursive: bool = True) -> List[Dict[str, Any]]`

フォルダー内のGASファイルを検索。

**パラメータ**:
- `folder_id`: フォルダーID
- `name_filter`: 名前フィルタ（部分一致、大文字小文字区別なし）
- `recursive`: サブフォルダーも検索

**戻り値**: ファイルメタデータのリスト

**例**:
```python
drive = DriveService(credentials)
files = drive.list_gas_files_in_folder(
    folder_id='1ABC...XYZ',
    name_filter='Appsheet',
    recursive=True
)

for file in files:
    print(f"Name: {file['name']}")
    print(f"ID: {file['id']}")
    print(f"Modified: {file['modifiedTime']}")
```

##### `get_file_metadata(file_id: str) -> Optional[Dict[str, Any]]`

ファイルのメタデータを取得。

**パラメータ**: `file_id` - ファイルID

**戻り値**: メタデータ辞書またはNone

**例**:
```python
metadata = drive.get_file_metadata('file_id_here')
if metadata:
    print(f"Name: {metadata['name']}")
    print(f"MIME: {metadata['mimeType']}")
```

##### `get_user_info() -> Dict[str, str]`

認証済みユーザー情報を取得。

**戻り値**: `{'email': str, 'name': str, 'permission_id': str}`

**例**:
```python
user = drive.get_user_info()
print(f"Logged in as: {user['email']}")
```

---

## Script操作

### ScriptService

```python
from src.services import ScriptService
```

#### コンストラクタ

```python
ScriptService(credentials: Credentials)
```

#### メソッド

##### `get_project_content(script_id: str) -> Optional[Dict[str, Any]]`

Apps Scriptプロジェクトの全コンテンツを取得。

**パラメータ**: `script_id` - Apps Script プロジェクトID

**戻り値**: プロジェクトコンテンツ辞書またはNone

**例**:
```python
script = ScriptService(credentials)
content = script.get_project_content('script_id_here')

if content:
    print(f"Files: {len(content['files'])}")
    for file in content['files']:
        print(f"  - {file['name']}.{file['type']}")
```

##### `parse_project(script_id: str, project_name: str, metadata: Dict[str, Any]) -> Optional[GASProject]`

プロジェクトをGASProjectモデルにパース。

**パラメータ**:
- `script_id`: プロジェクトID
- `project_name`: プロジェクト名
- `metadata`: Driveメタデータ

**戻り値**: `GASProject` インスタンスまたはNone

**例**:
```python
project = script.parse_project(
    script_id='abc123',
    project_name='My Project',
    metadata=file_metadata
)

if project:
    print(f"Project: {project.project_name}")
    print(f"Files: {len(project.files)}")
```

---

## Sheets操作

### SheetsService

```python
from src.services import SheetsService
```

#### コンストラクタ

```python
SheetsService(credentials: Credentials)
```

#### メソッド

##### `get_spreadsheet_metadata(spreadsheet_id: str) -> Optional[SpreadsheetInfo]`

スプレッドシートのメタデータを取得。

**パラメータ**: `spreadsheet_id` - スプレッドシートID

**戻り値**: `SpreadsheetInfo` インスタンスまたはNone

**例**:
```python
sheets = SheetsService(credentials)
info = sheets.get_spreadsheet_metadata('spreadsheet_id_here')

if info:
    print(f"Title: {info.title}")
    print(f"URL: {info.url}")
    print(f"Sheets: {len(info.sheets)}")
```

##### `get_multiple_spreadsheets(spreadsheet_ids: List[str]) -> List[SpreadsheetInfo]`

複数のスプレッドシートを一括取得。

**パラメータ**: `spreadsheet_ids` - スプレッドシートIDのリスト

**戻り値**: `SpreadsheetInfo` のリスト（エラーは除外）

**例**:
```python
ids = ['id1', 'id2', 'id3']
spreadsheets = sheets.get_multiple_spreadsheets(ids)

for sheet in spreadsheets:
    print(f"{sheet.title}: {sheet.url}")
```

---

## プロジェクト管理

### GASRetriever

```python
from src.services import GASRetriever
```

#### コンストラクタ

```python
GASRetriever(auth_service: AuthService, output_dir: Path)
```

**パラメータ**:
- `auth_service`: 認証サービスインスタンス
- `output_dir`: 出力ディレクトリ

#### メソッド

##### `retrieve_projects(folder_id: str, name_filter: Optional[str] = None, recursive: bool = True) -> List[Path]`

GASプロジェクトを取得して保存。

**パラメータ**:
- `folder_id`: 検索フォルダーID
- `name_filter`: 名前フィルタ
- `recursive`: 再帰検索

**戻り値**: 保存されたプロジェクトディレクトリのリスト

**例**:
```python
retriever = GASRetriever(
    auth_service=auth,
    output_dir=Path('gas_projects')
)

saved_paths = retriever.retrieve_projects(
    folder_id='folder_id_here',
    name_filter='Appsheet',
    recursive=True
)

print(f"Saved {len(saved_paths)} project(s)")
for path in saved_paths:
    print(f"  - {path}")
```

### ProjectSaver

```python
from src.services import ProjectSaver
```

#### コンストラクタ

```python
ProjectSaver(output_dir: Path)
```

#### メソッド

##### `save_project(project: GASProject) -> Optional[Path]`

GASProjectをファイルシステムに保存。

**パラメータ**: `project` - GASProjectインスタンス

**戻り値**: プロジェクトディレクトリパスまたはNone

**例**:
```python
saver = ProjectSaver(Path('gas_projects'))
path = saver.save_project(project)

if path:
    print(f"Saved to: {path}")
```

### ProjectAnalyzer

```python
from src.services import ProjectAnalyzer
```

#### コンストラクタ

```python
ProjectAnalyzer(projects_dir: Path)
```

#### メソッド

##### `find_projects_needing_dedup() -> List[ProjectAnalysis]`

重複防止が必要なプロジェクトを検索。

**戻り値**: `ProjectAnalysis` のリスト

**例**:
```python
analyzer = ProjectAnalyzer(Path('gas_projects'))
projects = analyzer.find_projects_needing_dedup()

print(f"Found {len(projects)} project(s) needing dedup")
for analysis in projects:
    print(f"  - {analysis.project_name}")
    print(f"    Gemini: {analysis.has_gemini_api}")
    print(f"    Webhook: {analysis.has_webhook}")
    print(f"    Record ID: {analysis.estimated_record_id_field}")
```

##### `analyze_project(project_dir: Path) -> Optional[ProjectAnalysis]`

単一プロジェクトを分析。

**パラメータ**: `project_dir` - プロジェクトディレクトリ

**戻り値**: `ProjectAnalysis` インスタンスまたはNone

### DedupApplicator

```python
from src.services import DedupApplicator
```

#### コンストラクタ

```python
DedupApplicator(library_file: Path)
```

**パラメータ**: `library_file` - DuplicationPrevention.gs のパス

**例外**: `FileNotFoundError` - ライブラリファイルが見つからない

#### メソッド

##### `apply_to_project(analysis: ProjectAnalysis) -> bool`

単一プロジェクトに適用。

**パラメータ**: `analysis` - ProjectAnalysisインスタンス

**戻り値**: 成功時True、スキップ/失敗時False

**例**:
```python
applicator = DedupApplicator(Path('DuplicationPrevention.gs'))
success = applicator.apply_to_project(analysis)

if success:
    print("Applied successfully")
else:
    print("Skipped or failed")
```

##### `apply_to_multiple(analyses: List[ProjectAnalysis]) -> dict`

複数プロジェクトに一括適用。

**パラメータ**: `analyses` - ProjectAnalysisのリスト

**戻り値**: 統計辞書 `{'applied': int, 'skipped': int, 'failed': int}`

**例**:
```python
stats = applicator.apply_to_multiple(analyses)
print(f"Applied: {stats['applied']}")
print(f"Skipped: {stats['skipped']}")
print(f"Failed: {stats['failed']}")
```

---

## ユーティリティ

### ファイルユーティリティ

```python
from src.utils import (
    sanitize_filename,
    extract_spreadsheet_ids,
    detect_pattern_in_code,
    extract_record_id_fields,
    ensure_directory,
    read_file_safely,
    write_file_safely
)
```

#### `sanitize_filename(name: str, max_length: int = 200) -> str`

ファイル名を安全な形式に変換。

**例**:
```python
safe_name = sanitize_filename("My Project: Test<>?*")
print(safe_name)  # "My Project_ Test_____"
```

#### `extract_spreadsheet_ids(source_code: str, patterns: List[str]) -> List[str]`

ソースコードからスプレッドシートIDを抽出。

**例**:
```python
from src.config import SPREADSHEET_ID_PATTERNS

code = '''
var ss = SpreadsheetApp.openById("1ABC...XYZ");
'''

ids = extract_spreadsheet_ids(code, SPREADSHEET_ID_PATTERNS)
print(ids)  # ['1ABC...XYZ']
```

#### `detect_pattern_in_code(code: str, patterns: List[str], case_insensitive: bool = True) -> bool`

コード内のパターンを検出。

**例**:
```python
from src.config import GEMINI_API_PATTERNS

code = "const result = gemini.generateContent(prompt);"
has_gemini = detect_pattern_in_code(code, GEMINI_API_PATTERNS)
print(has_gemini)  # True
```

#### `extract_record_id_fields(code: str) -> Optional[str]`

レコードIDフィールドを推定。

**例**:
```python
code = "const callId = params.callId;"
field = extract_record_id_fields(code)
print(field)  # "callId"
```

#### `ensure_directory(path: Path) -> None`

ディレクトリが存在することを保証（なければ作成）。

**例**:
```python
ensure_directory(Path('gas_projects/my_project/scripts'))
```

#### `read_file_safely(file_path: Path, encoding: str = 'utf-8') -> Optional[str]`

ファイルを安全に読み込み。

**例**:
```python
content = read_file_safely(Path('script.gs'))
if content:
    print(content)
```

#### `write_file_safely(file_path: Path, content: str, encoding: str = 'utf-8') -> bool`

ファイルを安全に書き込み。

**例**:
```python
success = write_file_safely(
    Path('output.txt'),
    'Hello, World!'
)
if success:
    print("Written successfully")
```

---

## 設定

### config.py

```python
from src import config
```

#### 主要な設定定数

```python
# Google Cloud
config.PROJECT_ID          # Google Cloud プロジェクトID
config.SCOPES              # 必要な権限スコープ

# パス
config.CREDENTIALS_FILE    # credentials.jsonのパス
config.TOKEN_FILE          # token.pickleのパス
config.OUTPUT_DIR          # 出力ディレクトリ
config.LIBRARY_FILE        # DuplicationPrevention.gsのパス

# Drive
config.FOLDER_ID           # デフォルトフォルダーID
config.PROJECT_NAME_FILTER # デフォルトフィルタ

# パターン
config.SPREADSHEET_ID_PATTERNS  # スプレッドシートID抽出パターン
config.GEMINI_API_PATTERNS      # Gemini API検出パターン
config.WEBHOOK_PATTERNS         # Webhook検出パターン
config.DEDUP_PATTERNS           # 重複防止検出パターン
```

**使用例**:
```python
from src import config

print(f"Project ID: {config.PROJECT_ID}")
print(f"Output dir: {config.OUTPUT_DIR}")
```

---

**バージョン**: 2.0  
**最終更新**: 2025-10-16
