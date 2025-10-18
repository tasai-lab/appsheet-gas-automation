# スクリプトアーキテクチャ - Appsheet_通話_イベント・タスク作成

## 概要

このドキュメントは、Appsheet_通話_イベント・タスク作成プロジェクトのスクリプト構成、処理フロー、アーキテクチャについて説明します。

## アーキテクチャ図

> **配色について**: このプロジェクトのMermaid図配色は [アーキテクチャ図配色ガイドライン](../../../docs/ARCHITECTURE_DIAGRAM_COLOR_GUIDE.md) に準拠しています。

```mermaid
graph TB
    subgraph "エントリーポイント"
        A[webhook.gs]
    end
    
    subgraph "メイン処理"
        B[action_processor.gs]
    end
    
    subgraph "Google API連携"
        C[google_service.gs]
        D[oauth_service.gs]
    end
    
    subgraph "AppSheet API"
        E[appsheet_api.gs]
    end
    
    subgraph "テスト"
        F[test_functions.gs]
    end
    
    A --> B
    B --> C
    B --> E
    C --> D
    F --> B
    
    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style C fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style D fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style E fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    style F fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
```

## ファイル別役割

### 1. エントリーポイント

#### `webhook.gs`
- **役割**: Webhookリクエスト受信とパラメータ抽出
- **主な関数**:
  - `doPost(e)` - POSTリクエストエントリーポイント
  - `processRequestDirect(...)` - 直接実行用ラッパー（9引数）
- **責務**: パラメータ正規化、processRequest呼び出し

### 2. メイン処理

#### `action_processor.gs`
- **役割**: アクション処理のメインロジックと分岐
- **主な関数**:
  - `processRequest(...)` - メイン処理関数（actionType判定、成功/エラーハンドリング）
- **処理分岐**:
  - `actionType='event'/'イベント'` → `createGoogleCalendarEvent()`
  - `actionType='task'/'タスク'` → `createGoogleTask()`
- **責務**: パラメータ検証、actionType正規化、結果処理、AppSheet更新呼び出し

### 3. Google API連携

#### `google_service.gs`
- **役割**: GoogleカレンダーとGoogleタスクのAPI呼び出し
- **主な関数**:
  - `createGoogleCalendarEvent(params)` - カレンダーイベント作成
  - `createGoogleTask(params)` - タスク作成
- **機能**:
  - 日本時間(JST)対応（Asia/Tokyo）
  - Calendar API v3使用
  - Tasks API v1使用
- **依存関係**: oauth_service.gs

#### `oauth_service.gs`
- **役割**: OAuth2認証サービス（サービスアカウント委任）
- **主な関数**:
  - `createOAuth2ServiceForUser(...)` - ユーザー代理OAuth2サービス作成
  - `getAccessToken(service)` - アクセストークン取得
  - `authCallback(request)` - OAuth2コールバック
- **認証方式**: サービスアカウントによるドメイン全体の委任

### 4. AppSheet API

#### `appsheet_api.gs`
- **役割**: AppSheet Call_Actionsテーブル更新
- **主な関数**:
  - `updateActionOnSuccess(...)` - 成功時更新（ステータス: 反映済み）
  - `updateActionOnError(...)` - エラー時更新（ステータス: エラー）
  - `callAppSheetApi(payload)` - AppSheet API呼び出し
- **設定**: APP_ID, ACCESS_KEY, ACTIONS_TABLE_NAME

### 5. テスト

#### `test_functions.gs`
- **役割**: イベント/タスク作成のテスト関数
- **主な関数**:
  - `testProcessRequestEvent()` - イベント作成テスト（英語パラメータ）
  - `testProcessRequestTask()` - タスク作成テスト（日本語パラメータ）
- **使用方法**: GASエディタから直接実行

## 処理フロー

### 1. イベント作成フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as webhook.gs
    participant AP as action_processor.gs
    participant GS as google_service.gs
    participant OS as oauth_service.gs
    participant Cal as Google Calendar
    participant API as appsheet_api.gs
    
    AS->>WH: doPost(actionType='event')
    WH->>AP: processRequest()
    
    AP->>AP: パラメータ検証
    AP->>AP: actionType正規化('event'/'イベント')
    
    AP->>GS: createGoogleCalendarEvent()
    GS->>OS: createOAuth2ServiceForUser()
    OS->>OS: サービスアカウント認証
    OS-->>GS: OAuth2 Service
    GS->>OS: getAccessToken()
    OS-->>GS: Access Token
    
    GS->>Cal: POST /calendar/v3/calendars/primary/events
    Note over GS,Cal: タイムゾーン: Asia/Tokyo
    Cal-->>GS: イベントID + htmlLink
    GS-->>AP: {status: SUCCESS, externalId, externalUrl}
    
    AP->>API: updateActionOnSuccess()
    API->>AS: AppSheet API (status: 反映済み)
    
    AP-->>WH: {success: true, externalId, externalUrl}
    WH-->>AS: レスポンス
    
    %% スタイル定義（ダークモード対応）
    %%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#1e3a5f','primaryTextColor':'#fff','primaryBorderColor':'#4a90e2','lineColor':'#4a90e2','secondaryColor':'#5f4c1e','tertiaryColor':'#1e5f3a'}}}%%
```

### 2. タスク作成フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as webhook.gs
    participant AP as action_processor.gs
    participant GS as google_service.gs
    participant OS as oauth_service.gs
    participant Tasks as Google Tasks
    participant API as appsheet_api.gs
    
    AS->>WH: doPost(actionType='task')
    WH->>AP: processRequest()
    
    AP->>AP: パラメータ検証
    AP->>AP: actionType正規化('task'/'タスク')
    
    AP->>GS: createGoogleTask()
    GS->>OS: createOAuth2ServiceForUser()
    OS->>OS: サービスアカウント認証
    OS-->>GS: OAuth2 Service
    GS->>OS: getAccessToken()
    OS-->>GS: Access Token
    
    GS->>Tasks: POST /tasks/v1/lists/@default/tasks
    Note over GS,Tasks: 日本時間(JST)でRFC3339形式
    Tasks-->>GS: タスクID + selfLink
    GS-->>AP: {status: SUCCESS, externalId, externalUrl}
    
    AP->>API: updateActionOnSuccess()
    API->>AS: AppSheet API (status: 反映済み)
    
    AP-->>WH: {success: true, externalId, externalUrl}
    WH-->>AS: レスポンス
    
    %% スタイル定義（ダークモード対応）
    %%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#1e3a5f','primaryTextColor':'#fff','primaryBorderColor':'#4a90e2','lineColor':'#4a90e2','secondaryColor':'#5f4c1e','tertiaryColor':'#1e5f3a'}}}%%
```

### 3. エラー処理フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as webhook.gs
    participant AP as action_processor.gs
    participant GS as google_service.gs
    participant API as appsheet_api.gs
    
    AS->>WH: doPost()
    WH->>AP: processRequest()
    
    alt パラメータ不足
        AP->>AP: throw Error('必須パラメータ不足')
    else Google API エラー
        AP->>GS: createGoogleCalendarEvent()
        GS->>GS: Calendar API呼び出し失敗
        GS-->>AP: {status: FAILURE, errorMessage}
        AP->>AP: throw Error(errorMessage)
    end
    
    AP->>API: updateActionOnError(errorMessage)
    API->>AS: AppSheet API (status: エラー)
    
    AP-->>WH: {success: false, error}
    WH-->>AS: エラーレスポンス
    
    %% スタイル定義（ダークモード対応）
    %%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#1e3a5f','primaryTextColor':'#fff','primaryBorderColor':'#4a90e2','lineColor':'#4a90e2','secondaryColor':'#5f4c1e','tertiaryColor':'#1e5f3a'}}}%%
```

## データフロー

### actionType判定処理

```mermaid
graph TD
    A[processRequest] --> B{actionType正規化}
    B -->|'event' or 'イベント'| C[イベント用検証]
    B -->|'task' or 'タスク'| D[タスク用検証]
    B -->|その他| E[エラー: 未対応のactionType]
    
    C --> F{startDateTime<br/>endDateTime<br/>あり?}
    F -->|Yes| G[createGoogleCalendarEvent]
    F -->|No| H[エラー: 必須パラメータ不足]
    
    D --> I{dueDateTime<br/>あり?}
    I -->|Yes| J[createGoogleTask]
    I -->|No| K[エラー: 必須パラメータ不足]
    
    G --> L[OAuth2認証]
    J --> L
    L --> M[Google API呼び出し]
    M --> N{成功?}
    N -->|Yes| O[updateActionOnSuccess]
    N -->|No| P[updateActionOnError]
    
    %% スタイル定義（ダークモード対応）
    style A fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    style B fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style E fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#fff
    style F fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style G fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#fff
    style H fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#fff
    style I fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style J fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#fff
    style K fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#fff
    style L fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#fff
    style M fill:#4a1e5f,stroke:#b84ae2,stroke-width:3px,color:#fff
    style N fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style O fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    style P fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#fff
```

## パラメータマッピング

### イベント作成パラメータ

| AppSheet | webhook.gs | action_processor.gs | google_service.gs |
|----------|-----------|-------------------|------------------|
| `action_id` | `actionId` | `actionId` | - |
| `action_type` | `actionType` | `normalizedActionType` | - |
| `title` | `title` | `title` | `params.title` → `summary` |
| `details` | `details` | `details` | `params.details` → `description` |
| `start_datetime` | `startDateTime` | `startDateTime` | `params.startDateTime` → `start.dateTime` |
| `end_datetime` | `endDateTime` | `endDateTime` | `params.endDateTime` → `end.dateTime` |
| `assignee_email` | `assigneeEmail` | `assigneeEmail` | `params.assigneeEmail` → OAuth2 subject |
| `row_url` | `rowUrl` | `rowUrl` | `params.rowUrl` → `description` |

### タスク作成パラメータ

| AppSheet | webhook.gs | action_processor.gs | google_service.gs |
|----------|-----------|-------------------|------------------|
| `action_id` | `actionId` | `actionId` | - |
| `action_type` | `actionType` | `normalizedActionType` | - |
| `title` | `title` | `title` | `params.title` → `title` |
| `details` | `details` | `details` | `params.details` → `notes` |
| `due_datetime` | `dueDateTime` | `dueDateTime` | `params.dueDateTime` → `due` |
| `assignee_email` | `assigneeEmail` | `assigneeEmail` | `params.assigneeEmail` → OAuth2 subject |

## 命名規則

### ファイル名

- **エントリーポイント**: `webhook.gs`
- **プロセッサ**: `{機能名}_processor.gs` (例: action_processor.gs)
- **サービス**: `{機能名}_service.gs` (例: google_service.gs, oauth_service.gs)
- **API**: `{サービス名}_api.gs` (例: appsheet_api.gs)
- **テスト**: `test_functions.gs`

### 関数名

- **公開関数**: キャメルケース (例: `processRequest`, `createGoogleCalendarEvent`)
- **テスト関数**: `test` プレフィックス (例: `testProcessRequestEvent`)
- **ヘルパー関数**: キャメルケース (例: `updateActionOnSuccess`)

## 設定

### スクリプトプロパティ

- `SERVICE_ACCOUNT_JSON`: サービスアカウントのJSONキー（OAuth2認証用）

### 定数

#### appsheet_api.gs

```javascript
const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f';
const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT';
const ACTIONS_TABLE_NAME = 'Call_Actions';
```

#### oauth_service.gs

```javascript
const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';
const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';
```

## OAuth2スコープ

### イベント作成

```javascript
['https://www.googleapis.com/auth/calendar']
```

### タスク作成

```javascript
['https://www.googleapis.com/auth/tasks']
```

## デプロイ

### バックアップ除外

`.claspignore` により以下のファイルはGASにプッシュされません:

```
**/_backup/**
*_backup.gs
*_OLD.gs
*_v[0-9]*.gs
```

### デプロイコマンド

```bash
# プロジェクトディレクトリに移動
cd gas_projects/Appsheet_通話_イベント・タスク作成

# プッシュ
clasp push

# デプロイ
clasp deploy --description "v2: 説明"
```

## トラブルシューティング

### OAuth2エラー

**症状**: `OAuth2アクセストークン取得失敗`

**対策**:
1. `SERVICE_ACCOUNT_JSON` スクリプトプロパティが設定されているか確認
2. サービスアカウントにドメイン全体の委任が有効か確認
3. 必要なスコープ（Calendar/Tasks）が付与されているか確認

### パラメータエラー

**症状**: `必須パラメータ不足`

**対策**:
- イベント作成: `actionId`, `actionType`, `title`, `assigneeEmail`, `startDateTime`, `endDateTime` が必須
- タスク作成: `actionId`, `actionType`, `title`, `assigneeEmail`, `dueDateTime` が必須
- `actionType` は `'event'`/`'イベント'` または `'task'`/`'タスク'` のみ対応

### 日時エラー

**症状**: イベント/タスクが正しい時刻に作成されない

**対策**:
- 日時は日本時間(JST)で `YYYY-MM-DDTHH:mm:ss+09:00` 形式で指定
- タイムゾーンは `Asia/Tokyo` に自動設定される

## 変更履歴

### v2 (2025-10-17)
- ✨ スクリプト役割別分割実施
- ✅ 新ファイル: webhook.gs, action_processor.gs, google_service.gs, oauth_service.gs, appsheet_api.gs, test_functions.gs
- 📦 旧ファイルアーカイブ: コード.gs → _backup/コード_OLD.gs

### v1.1 (2025-10-17)
- 日本語パラメータ対応（'イベント'/'タスク'）
- 日本時間(JST)処理の明確化

### v1.0 (2025-10-17)
- 初回リリース（イベント作成・タスク作成統合）

## 参考ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference)
- [Google Tasks API v1](https://developers.google.com/tasks/reference/rest)
