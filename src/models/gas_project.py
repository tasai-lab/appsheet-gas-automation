"""
Data models for GAS project representation.
"""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any


@dataclass
class GASFile:
    """Represents a single Google Apps Script file."""
    name: str
    file_type: str
    source: str
    
    @property
    def extension(self) -> str:
        """Get file extension based on type."""
        from ..config import GAS_FILE_EXTENSIONS, DEFAULT_EXTENSION
        return GAS_FILE_EXTENSIONS.get(self.file_type, DEFAULT_EXTENSION)
    
    @property
    def filename(self) -> str:
        """Get full filename with extension."""
        return f"{self.name}{self.extension}"


@dataclass
class SpreadsheetInfo:
    """Represents spreadsheet metadata."""
    spreadsheet_id: str
    title: str
    url: str
    sheets: List[Dict[str, Any]] = field(default_factory=list)
    properties: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> 'SpreadsheetInfo':
        """Create SpreadsheetInfo from Google Sheets API response."""
        properties = data.get('properties', {})
        return cls(
            spreadsheet_id=data.get('spreadsheetId', ''),
            title=properties.get('title', 'Untitled'),
            url=data.get('spreadsheetUrl', ''),
            sheets=data.get('sheets', []),
            properties=properties
        )


@dataclass
class GASProject:
    """Represents a complete Google Apps Script project."""
    project_id: str
    project_name: str
    files: List[GASFile] = field(default_factory=list)
    manifest: Optional[Dict[str, Any]] = None
    spreadsheets: List[SpreadsheetInfo] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_time: Optional[datetime] = None
    modified_time: Optional[datetime] = None
    owners: List[Dict[str, str]] = field(default_factory=list)
    
    @property
    def safe_name(self) -> str:
        """Get filesystem-safe project name."""
        import re
        name = re.sub(r'[<>:"/\\|?*]', '_', self.project_name)
        name = name.strip('. ')
        return name[:200]
    
    def add_file(self, name: str, file_type: str, source: str) -> None:
        """Add a script file to the project."""
        self.files.append(GASFile(name, file_type, source))
    
    def add_spreadsheet(self, spreadsheet_info: SpreadsheetInfo) -> None:
        """Add a spreadsheet reference to the project."""
        self.spreadsheets.append(spreadsheet_info)


@dataclass
class ProjectAnalysis:
    """Analysis results for a GAS project."""
    project_name: str
    project_path: Path
    has_gemini_api: bool = False
    has_webhook: bool = False
    has_duplication_prevention: bool = False
    webhook_file: Optional[Path] = None
    estimated_record_id_field: Optional[str] = None
    gemini_files: List[Path] = field(default_factory=list)
    webhook_files: List[Path] = field(default_factory=list)
    
    @property
    def needs_duplication_prevention(self) -> bool:
        """Check if project needs duplication prevention."""
        return (self.has_gemini_api and 
                self.has_webhook and 
                not self.has_duplication_prevention)


@dataclass
class MigrationGuide:
    """Migration guide data for a project."""
    project_name: str
    webhook_file: str
    record_id_field: Optional[str]
    has_existing_prevention: bool
    
    def to_markdown(self) -> str:
        """Generate markdown content for migration guide."""
        return f"""
# {self.project_name} - 重複防止実装ガイド

## 自動検出情報
- Webhook ファイル: {self.webhook_file}
- 推定レコードIDフィールド: {self.record_id_field or '不明（手動確認が必要）'}
- 既存の重複防止: {'✅ あり' if self.has_existing_prevention else '❌ なし'}

## 実装手順

### 1. ライブラリの追加
✅ 完了: `utils_duplicationPrevention.gs` が追加されました

### 2. doPost関数の修正

#### 修正後のコード（推奨）:
```javascript
function doPost(e) {{
  return executeWebhookWithDuplicationPrevention(e, processWebhook, {{
    recordIdField: '{self.record_id_field or 'recordId'}',
    enableFingerprint: true
  }});
}}

function processWebhook(params) {{
  const {self.record_id_field or 'recordId'} = params.{self.record_id_field or 'recordId'};
  
  // 既存の処理ロジック...
  
  return {{
    success: true,
    {self.record_id_field or 'recordId'}: {self.record_id_field or 'recordId'}
  }};
}}
```

### 3. テスト方法

1. Apps Scriptエディタでコードを保存
2. Webアプリとして再デプロイ
3. 同じリクエストを複数回送信してテスト
4. ログで重複検知を確認

詳細: DUPLICATION_PREVENTION_GUIDE.md を参照
"""
