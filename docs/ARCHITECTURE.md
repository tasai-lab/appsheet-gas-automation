# GAS Retriever - アーキテクチャドキュメント

## 目次

1. [システム概要](#システム概要)
2. [アーキテクチャ図](#アーキテクチャ図)
3. [モジュール詳細](#モジュール詳細)
4. [シーケンス図](#シーケンス図)
5. [データフロー](#データフロー)

## システム概要

### 目的

Google DriveからGoogle Apps Script (GAS) プロジェクトを取得し、構造化されたフォーマットで保存するシステム。Gemini APIを使用するプロジェクトに対しては、Webhook重複実行防止機能を自動適用します。

### 主要機能

1. **GAS取得機能** (`retrieve_gas.py`)
   - Google DriveからGASプロジェクトを検索・取得
   - スプレッドシート参照の自動検出
   - 構造化された形式で保存

2. **重複防止適用機能** (`apply_dedup.py`)
   - Gemini API使用プロジェクトの分析
   - 重複防止ライブラリの自動適用
   - 移行ガイドの生成

## アーキテクチャ図

### システム全体構成

```mermaid
graph TB
    subgraph "CLI Layer"
        CLI1[retrieve_gas.py]
        CLI2[apply_dedup.py]
    end
    
    subgraph "Service Layer"
        AUTH[AuthService]
        DRIVE[DriveService]
        SCRIPT[ScriptService]
        SHEETS[SheetsService]
        RETRIEVER[GASRetriever]
        SAVER[ProjectSaver]
        ANALYZER[ProjectAnalyzer]
        APPLICATOR[DedupApplicator]
    end
    
    subgraph "Model Layer"
        MODELS[GASProject<br/>SpreadsheetInfo<br/>ProjectAnalysis]
    end
    
    subgraph "Utility Layer"
        UTILS[FileUtils]
    end
    
    subgraph "Config"
        CONFIG[config.py]
    end
    
    subgraph "External APIs"
        GOOGLE[Google APIs]
    end
    
    subgraph "Storage"
        FS[FileSystem]
    end
    
    CLI1 --> RETRIEVER
    CLI2 --> ANALYZER
    CLI2 --> APPLICATOR
    
    RETRIEVER --> AUTH
    RETRIEVER --> DRIVE
    RETRIEVER --> SCRIPT
    RETRIEVER --> SHEETS
    RETRIEVER --> SAVER
    
    AUTH --> GOOGLE
    DRIVE --> GOOGLE
    SCRIPT --> GOOGLE
    SHEETS --> GOOGLE
    
    SAVER --> FS
    SAVER --> MODELS
    
    RETRIEVER --> MODELS
    ANALYZER --> MODELS
```

### レイヤー構成

```mermaid
graph LR
    A[CLI Scripts] --> B[Service Classes]
    B --> C[Models]
    B --> D[Google APIs & FileSystem]
```

## シーケンス図

### GAS取得プロセス

```mermaid
sequenceDiagram
    actor User
    participant CLI as retrieve_gas.py
    participant Retriever as GASRetriever
    participant Auth as AuthService
    participant Drive as DriveService
    participant Script as ScriptService
    participant Sheets as SheetsService
    participant Saver as ProjectSaver
    
    User->>CLI: python retrieve_gas.py
    CLI->>Auth: get_credentials()
    Auth-->>CLI: credentials
    
    CLI->>Retriever: retrieve_projects(folder_id)
    
    Retriever->>Drive: list_gas_files_in_folder()
    Drive-->>Retriever: List[file_metadata]
    
    loop For each GAS file
        Retriever->>Script: parse_project(script_id)
        Script-->>Retriever: GASProject
        
        Retriever->>Retriever: extract_spreadsheet_ids()
        
        alt Has spreadsheet references
            Retriever->>Sheets: get_multiple_spreadsheets()
            Sheets-->>Retriever: List[SpreadsheetInfo]
        end
        
        Retriever->>Saver: save_project(project)
        Saver-->>Retriever: project_path
    end
    
    Retriever-->>CLI: List[saved_paths]
    CLI->>User: Display summary
```

### 重複防止適用プロセス

```mermaid
sequenceDiagram
    actor User
    participant CLI as apply_dedup.py
    participant Analyzer as ProjectAnalyzer
    participant Applicator as DedupApplicator
    participant FS as FileSystem
    
    User->>CLI: python apply_dedup.py
    
    CLI->>Analyzer: find_projects_needing_dedup()
    
    loop For each project
        Analyzer->>FS: read script files
        Analyzer->>Analyzer: detect patterns
        Analyzer->>Analyzer: create ProjectAnalysis
    end
    
    Analyzer-->>CLI: List[ProjectAnalysis]
    
    CLI->>Applicator: apply_to_multiple(analyses)
    
    loop For each project
        Applicator->>FS: copy library file
        Applicator->>FS: write MIGRATION_GUIDE.md
    end
    
    Applicator-->>CLI: statistics
    CLI->>User: Display summary
```

### 認証フロー

```mermaid
sequenceDiagram
    participant App
    participant Auth as AuthService
    participant Cache as token.pickle
    participant Google as Google OAuth
    
    App->>Auth: get_credentials()
    Auth->>Cache: read token
    
    alt Token valid
        Cache-->>Auth: credentials
    else Token expired
        Auth->>Google: refresh token
        Google-->>Auth: new token
        Auth->>Cache: save token
    else No token
        Auth->>Google: OAuth flow
        Google-->>Auth: tokens
        Auth->>Cache: save token
    end
    
    Auth-->>App: credentials
```

## データフロー

### GAS取得

```mermaid
flowchart LR
    A[Google Drive] --> B[DriveService]
    B --> C[File List]
    C --> D[ScriptService]
    D --> E[Script Content]
    E --> F[GASProject]
    F --> G[Extract IDs]
    G --> H[SheetsService]
    H --> I[Spreadsheet Data]
    I --> F
    F --> J[ProjectSaver]
    J --> K[FileSystem]
```

### エラーハンドリング

```mermaid
flowchart TD
    A[処理開始] --> B{認証OK?}
    B -->|No| C[終了コード1]
    B -->|Yes| D{フォルダー存在?}
    D -->|No| E[エラーログ+継続]
    D -->|Yes| F[処理実行]
    F --> G{成功?}
    G -->|No| H[エラーログ]
    G -->|Yes| I[成功]
    H --> J[次の処理]
    I --> J
    J --> K[終了コード0]
```

---

**作成日**: 2025-10-16  
**バージョン**: 2.0
