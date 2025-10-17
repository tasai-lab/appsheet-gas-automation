# スクリプトアーキテクチャ - Appsheet_営業_音声記録

## 概要

このドキュメントは、Appsheet_営業_音声記録プロジェクトのスクリプト構成、処理フロー、アーキテクチャについて説明します。

## アーキテクチャ図

> **配色について**: このプロジェクトのMermaid図配色は [アーキテクチャ図配色ガイドライン](../../../docs/ARCHITECTURE_DIAGRAM_COLOR_GUIDE.md) に準拠しています。

```mermaid
graph TB
    subgraph "エントリーポイント"
        A[webhook.gs]
    end
    
    subgraph "メイン処理"
        B[sales_audio_processor.gs]
    end
    
    subgraph "AI分析"
        C[gemini_service.gs]
    end
    
    subgraph "Google Drive操作"
        D[drive_utils.gs]
    end
    
    subgraph "AppSheet API"
        E[appsheet_api.gs]
    end
    
    subgraph "ユーティリティ"
        F[utils_duplicationPrevention.gs]
    end
    
    subgraph "テスト"
        G[test_functions.gs]
    end
    
    A --> B
    B --> C
    B --> E
    B --> F
    G --> B
    C --> D
    D -.Google Drive.-> H[(音声ファイル)]
    
    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style C fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style D fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style E fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    style F fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style G fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style H fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
```

## ファイル別役割

### 1. エントリーポイント

#### `webhook.gs`
- **役割**: Webhookリクエスト受信とパラメータ抽出
- **主な関数**:
  - `doPost(e)` - POSTリクエストエントリーポイント
  - `processSalesAudioAnalysisDirect(...)` - 直接実行用関数（個別引数5つ）
- **責務**: パラメータ解析、processSalesAudioAnalysis呼び出し
- **改善点（v3）**: 個別引数での直接実行に対応、ログ出力強化

### 2. メイン処理

#### `sales_audio_processor.gs`
- **役割**: 営業音声分析処理の統括
- **主な関数**:
  - `processSalesAudioAnalysis(...)` - メイン処理関数（パラメータ検証、分析実行、結果更新）
- **責務**: 
  - パラメータ検証
  - コンテキスト情報構築
  - Gemini API呼び出し
  - AppSheet更新呼び出し
  - エラーハンドリング

### 3. AI分析

#### `gemini_service.gs`
- **役割**: Gemini APIによる音声分析と評価
- **主な関数**:
  - `analyzeSalesCallWithGemini(context)` - 音声ファイルを分析
  - `callGeminiAPIForSalesAnalysis(...)` - Gemini API呼び出し
  - `buildSalesAnalysisPrompt(context)` - 分析用プロンプト生成
- **機能**:
  - drive_utils統合による音声ファイル取得
  - ファイルサイズ検証（20MB上限）
  - Base64エンコーディング
  - Gemini 2.0 Flash APIでの分析
  - 評価指標に基づくJSON生成
- **評価指標**: 
  - 関心度（INT-01～05）
  - 当社認知度（AWR-01～03）
  - 印象（IMP-01～05）
  - サービス理解度（UND-01～03）
  - など全14項目
- **依存関係**: drive_utils.gs
- **改善点（v3）**: 
  - モデル変更（gemini-2.5-pro → gemini-2.0-flash-exp）
  - エラーハンドリング強化
  - ログ出力の詳細化

### 4. Google Drive操作

#### `drive_utils.gs`
- **役割**: 音声ファイルの取得、検証、エンコーディング
- **主な関数**:
  - `getAudioFile(fileId)` - ファイル取得とMIMEタイプ判定
  - `determineMimeType(fileName, blob)` - MIMEタイプ判定
  - `encodeAudioToBase64(blob)` - Base64エンコード
  - `validateFileSize(blob, maxSizeMB)` - ファイルサイズ検証
  - `getFileIdFromPath(filePath, baseFolderId)` - パスからファイルID取得
- **機能**:
  - 音声・動画形式のサポート（m4a, mp3, wav, ogg, flac, aac, opus, webm, 3gp, mov）
  - 拡張子とBlobからのMIMEタイプ判定
  - ファイルサイズチェック
  - 共有ドライブ対応
- **改善点（v3）**: 
  - 通話_要約生成のVertex AIパターンに準拠
  - ログ出力の統一（[Drive]プレフィックス）
  - 処理時間計測機能追加

### 4. AppSheet API

#### `appsheet_api.gs`
- **役割**: AppSheet Sales_Activitiesテーブル更新
- **主な関数**:
  - `updateActivityOnSuccess(...)` - 分析成功時の更新（ステータス: 編集中）
  - `updateActivityOnError(...)` - エラー時の更新（ステータス: エラー）
  - `callAppSheetApi(payload)` - AppSheet API呼び出し
- **設定**: APP_ID, ACCESS_KEY, ACTIVITIES_TABLE_NAME

### 5. ユーティリティ

#### `utils_duplicationPrevention.gs`
- **役割**: 重複処理防止
- **機能**: 同一リクエストの重複実行を防止
- **詳細**: 共通モジュールから継承

### 6. テスト

#### `test_functions.gs`
- **役割**: 各機能のテスト関数
- **主な関数**:
  - `testProcessSalesAudioAnalysis()` - 営業音声分析の総合テスト
  - `testGeminiApiConnection()` - Gemini API接続テスト
  - `testAppSheetApiConnection()` - AppSheet API接続テスト
- **使用方法**: GASエディタから直接実行

## 処理フロー

### 1. 営業音声分析フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as webhook.gs
    participant PR as sales_audio_processor.gs
    participant GS as gemini_service.gs
    participant DR as Google Drive
    participant GA as Gemini API
    participant API as appsheet_api.gs
    
    AS->>WH: doPost(activityId, audioFileId, ...)
    WH->>PR: processSalesAudioAnalysis()
    
    PR->>PR: パラメータ検証
    PR->>PR: コンテキスト構築
    
    PR->>GS: analyzeSalesCallWithGemini(context)
    GS->>DR: getFileById(audioFileId)
    DR-->>GS: audioBlob
    GS->>GS: determineMimeType()
    GS->>GS: buildSalesAnalysisPrompt()
    GS->>GS: Base64エンコード
    
    GS->>GA: POST /v1beta/models/gemini-2.0-flash-exp:generateContent
    Note over GS,GA: 音声+プロンプト送信
    GA-->>GS: JSON分析結果（評価指標ID含む）
    GS-->>PR: analysisResult
    
    PR->>API: updateActivityOnSuccess()
    API->>AS: AppSheet API (status: 編集中)
    
    PR-->>WH: {status: SUCCESS, analysis}
    WH-->>AS: 成功レスポンス
    
    %% スタイル定義（ダークモード対応）
    %%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#1e3a5f','primaryTextColor':'#fff','primaryBorderColor':'#4a90e2','lineColor':'#4a90e2','secondaryColor':'#5f4c1e','tertiaryColor':'#1e5f3a'}}}%%
```

### 2. エラー処理フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as webhook.gs
    participant PR as sales_audio_processor.gs
    participant GS as gemini_service.gs
    participant API as appsheet_api.gs
    
    AS->>WH: doPost()
    WH->>PR: processSalesAudioAnalysis()
    
    alt パラメータ不足
        PR->>PR: throw Error('必須パラメータ不足')
    else ファイル取得エラー
        PR->>GS: analyzeSalesCallWithGemini()
        GS->>GS: Google Drive接続失敗
        GS-->>PR: Error
    else Gemini APIエラー
        PR->>GS: analyzeSalesCallWithGemini()
        GS->>GS: Gemini API呼び出し失敗
        GS-->>PR: Error
    end
    
    PR->>API: updateActivityOnError(errorMessage)
    API->>AS: AppSheet API (status: エラー)
    
    PR-->>WH: throw Error
    WH-->>AS: エラーレスポンス
    
    %% スタイル定義（ダークモード対応）
    %%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#1e3a5f','primaryTextColor':'#fff','primaryBorderColor':'#4a90e2','lineColor':'#4a90e2','secondaryColor':'#5f4c1e','tertiaryColor':'#1e5f3a'}}}%%
```

### 3. AI分析プロセス

```mermaid
graph TD
    A[音声ファイル取得] --> B{MIMEタイプ判定}
    B -->|拡張子から| C[m4a/mp3/wav/ogg/flac]
    B -->|Blobから| D[ContentType取得]
    C --> E[Base64エンコード]
    D --> E
    
    E --> F[プロンプト生成]
    F --> G[Gemini API呼び出し]
    
    G --> H{レスポンス検証}
    H -->|有効| I[JSON解析]
    H -->|無効| J[エラー]
    
    I --> K[評価指標ID抽出]
    K --> L[14項目の定量評価]
    K --> M[定性評価テキスト]
    
    L --> N[分析結果返却]
    M --> N
    
    %% スタイル定義（ダークモード対応）
    style A fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
    style B fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style E fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style F fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#fff
    style G fill:#4a1e5f,stroke:#b84ae2,stroke-width:3px,color:#fff
    style H fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style I fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style J fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#fff
    style K fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    style L fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    style M fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    style N fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
```

## データフロー

### パラメータマッピング

| AppSheet | webhook.gs | sales_audio_processor.gs | gemini_service.gs |
|----------|-----------|------------------------|------------------|
| `activity_id` | `activityId` | `activityId` | - |
| `audio_file_id` | `audioFileId` | `audioFileId` | `context.audioFileId` |
| `salesperson_name` | `salespersonName` | `salespersonName` | `context.salespersonName` |
| `contact_name` | `contactName` | `contactName` | `context.contactName` |
| `org_name` | `orgName` | `orgName` | `context.orgName` |

### AI分析結果マッピング（一部抜粋）

| AI出力フィールド | 説明 | 型 | 例 |
|---------------|------|----|----|
| `interest_level` | 関心度 | 評価指標ID | "INT-02" |
| `knows_us` | 当社認知度 | 評価指標ID | "AWR-01" |
| `our_impression` | 当社の印象 | 評価指標ID | "IMP-02" |
| `office_impression` | 事業所の印象 | テキスト | "明るく活気のある雰囲気" |
| `hearing_details` | ヒアリング内容 | テキスト | "・利用者の急な状態変化への対応..." |
| `summary` | 全体要約 | テキスト | "非常に関心が高く..." |

## 評価指標一覧

### 定量評価（評価指標ID）

1. **関心度** (interest_level): INT-01～05
2. **当社認知度** (knows_us): AWR-01～03
3. **当社印象** (our_impression): IMP-01～05
4. **営業時間認知** (knows_hours): HRS-01～03
5. **専門職種認知** (knows_job_types): STF-01～03
6. **時間差認知** (knows_time_diff): TIM-01～04
7. **サービス理解度** (understands_services): UND-01～03
8. **訪問看護印象** (overall_vhns_impression): OVL-01～03
9. **連携悩み** (has_coop_issues): CWP-01～02
10. **業務悩み** (has_work_issues): WKP-01～03
11. **その他悩み** (has_other_issues): OTH-01～02
12. **営業頻度** (sales_frequency_plan): FRQ-01～05

### 定性評価（テキスト）

- **office_impression**: 訪問した事業所の雰囲気
- **contact_impression**: 面会相手の反応や人柄
- **hearing_details**: ヒアリング内容の要点
- **coop_issue_details**: 連携における悩みの具体的内容
- **work_issue_details**: 業務における悩みの具体的内容
- **follow_up_task_details**: 営業先からの宿題
- **next_approach**: 次回のアプローチ方針
- **summary**: 営業活動全体の要約

## 命名規則

### ファイル名

- **エントリーポイント**: `webhook.gs`
- **プロセッサ**: `{機能名}_processor.gs` (例: sales_audio_processor.gs)
- **サービス**: `{機能名}_service.gs` (例: gemini_service.gs)
- **API**: `{サービス名}_api.gs` (例: appsheet_api.gs)
- **ユーティリティ**: `utils_{機能名}.gs` (例: utils_duplicationPrevention.gs)
- **テスト**: `test_functions.gs`

### 関数名

- **公開関数**: キャメルケース (例: `processSalesAudioAnalysis`, `analyzeSalesCallWithGemini`)
- **テスト関数**: `test` プレフィックス (例: `testProcessSalesAudioAnalysis`)
- **ヘルパー関数**: キャメルケース (例: `determineMimeType`, `buildSalesAnalysisPrompt`)

## 設定

### 定数

#### gemini_service.gs

```javascript
const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';
const GEMINI_MODEL = 'gemini-2.5-pro';
```

#### appsheet_api.gs

```javascript
const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e';
const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP';
const ACTIVITIES_TABLE_NAME = 'Sales_Activities';
```

### サポートされる音声形式

| 拡張子 | MIMEタイプ |
|--------|-----------|
| m4a | audio/mp4 |
| mp3 | audio/mpeg |
| wav | audio/wav |
| ogg | audio/ogg |
| flac | audio/flac |

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
cd gas_projects/Appsheet_営業_音声記録/scripts

# プッシュ
clasp push

# デプロイ
clasp deploy --description "v2: 説明"
```

## トラブルシューティング

### Gemini APIエラー

**症状**: `AIからの応答に有効な候補が含まれていません`

**対策**:
1. `GEMINI_API_KEY` が正しく設定されているか確認
2. 音声ファイルがサポートされている形式か確認（m4a, mp3, wav, ogg, flac）
3. ファイルサイズが制限内か確認（Gemini APIの制限）
4. APIレスポンスをログで確認

### パラメータエラー

**症状**: `必須パラメータ（activityId, audioFileId）が不足しています`

**対策**:
- `activityId`: 活動IDが必須
- `audioFileId`: Google DriveのファイルIDが必須
- `salespersonName`, `contactName`, `orgName`: 任意（未設定時は「不明」）

### ファイル取得エラー

**症状**: Google Driveからのファイル取得失敗

**対策**:
1. `audioFileId` が正しいか確認
2. GASスクリプトにDriveへのアクセス権限があるか確認
3. ファイルが削除されていないか確認
4. ファイルの共有設定を確認

### AppSheet更新エラー

**症状**: `AppSheet API Error: 400/401/403`

**対策**:
1. `APP_ID` と `ACCESS_KEY` が正しいか確認
2. `ACTIVITIES_TABLE_NAME` がテーブル名と一致しているか確認
3. AppSheetアプリがデプロイされているか確認

## 変更履歴

### v3 (2025-10-17)
- 🔧 音声ファイル・Gemini取扱の最適化
- ✨ drive_utils.gs追加（通話_要約生成のVertex AIパターンに準拠）
- 🎯 Webhookの個別引数対応（直接実行可能に）
- 📝 ログ出力の統一とプレフィックス追加（[Drive], [Gemini]）
- 🚀 Geminiモデル変更（gemini-2.5-pro → gemini-2.0-flash-exp）
- ⚡ ファイルサイズ検証機能追加
- 🔍 エラーハンドリング強化

### v2 (2025-10-17)
- ✨ スクリプト役割別分割実施
- ✅ 新ファイル: webhook.gs, sales_audio_processor.gs, gemini_service.gs, appsheet_api.gs, test_functions.gs
- 📦 旧ファイルアーカイブ: コード.gs → _backup/コード_OLD.gs
- 🎨 音声形式サポート拡張（wav, ogg, flac追加）
- 🧪 テスト関数の充実（API接続テスト追加）

### v1 (2025-10-16)
- 初回リリース（営業音声記録分析機能）

## 参考ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 詳細仕様
- [Gemini API Documentation](https://ai.google.dev/api/rest) - Gemini APIリファレンス
