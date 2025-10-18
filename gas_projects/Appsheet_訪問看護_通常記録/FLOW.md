# Appsheet_訪問看護_通常記録 - フロー図

## システム概要

訪問看護記録の自動生成を行うGASプロジェクト。通常記録と精神科記録の両方に対応し、Gemini 2.5-proを使用してAI支援による記録作成を実現します。

## メイン処理フロー

```mermaid
flowchart TD
    A[AppSheet Webhook] -->|POST Request| B[doPost]
    B --> C{パラメータ検証}
    C -->|失敗| D[エラーログ記録]
    D --> E[エラーレスポンス]

    C -->|成功| F[CommonWebhook.handleDoPost]
    F --> G[processRequest]

    G --> H{recordType判定}
    H -->|通常| I1[通常記録処理]
    H -->|精神| I2[精神科記録処理]

    I1 --> J[マスターデータ取得]
    I2 --> J

    J --> K{fileId/filePath<br/>あり?}
    K -->|あり| L[音声ファイル処理]
    K -->|なし| M[テキストのみ処理]

    L --> N[Cloud Storageアップロード]
    N --> O{処理モード}
    M --> O

    O -->|vertex-ai| P[Vertex AI API]
    O -->|fallback| Q[Gemini API]

    P --> R[AIレスポンスパース]
    Q --> R

    R --> S[フィールドマッピング]
    S --> T[AppSheet更新]
    T --> U[Cloud Storageクリーンアップ]
    U --> V[成功ログ記録]
    V --> W[成功レスポンス]

    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style G fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style L fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style N fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style P fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style Q fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style T fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
```

## 記録タイプ判定フロー

```mermaid
flowchart LR
    A[recordType入力] --> B{recordType<br/>指定あり?}
    B -->|なし| C[デフォルト: 通常]
    B -->|あり| D{値判定}

    D -->|"精神"| E[精神科記録]
    D -->|"通常"| F[通常記録]
    D -->|その他| G[警告ログ]
    G --> C

    E --> H[精神科フィールド]
    F --> I[通常フィールド]
    C --> I

    H --> J[精神科プロンプト]
    I --> K[通常プロンプト]

    style B fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style E fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style F fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
```

## 音声ファイル処理フロー

```mermaid
sequenceDiagram
    participant P as processRequest
    participant D as DriveApp
    participant CS as Cloud Storage
    participant AI as Vertex AI/Gemini

    P->>D: fileId/filePathからファイル取得
    D-->>P: File Blob + MIME Type

    P->>P: ファイル名とMIME検証

    P->>CS: uploadToCloudStorage
    CS->>CS: バケットにアップロード
    CS-->>P: gsUri (gs://bucket/file)

    P->>AI: gsUri + mimeType + prompt
    AI-->>P: 生成結果JSON

    P->>CS: deleteFromCloudStorage
    CS->>CS: ファイル削除
    CS-->>P: 削除完了

    style P fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style D fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style CS fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style AI fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
```

## AIモデル選択フロー

```mermaid
flowchart TD
    A[AI処理開始] --> B{processingMode}
    B -->|vertex-ai| C{gsUriあり?}
    B -->|その他| D[Gemini APIフォールバック]

    C -->|あり| E[Vertex AI<br/>gemini-2.5-pro]
    C -->|なし| D

    E --> F{レスポンス<br/>成功?}
    D --> G{レスポンス<br/>成功?}

    F -->|成功| H[JSONパース]
    F -->|失敗| I[リトライ<br/>最大3回]
    G -->|成功| H
    G -->|失敗| J[エラースロー]

    I --> K{リトライ<br/>カウント}
    K -->|上限未満| E
    K -->|上限到達| J

    H --> L[フィールド検証]
    L --> M{必須フィールド<br/>存在?}
    M -->|あり| N[結果返却]
    M -->|なし| O[デフォルト値設定]
    O --> N

    style E fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style D fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style H fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
```

## フィールドマッピングフロー

```mermaid
flowchart LR
    A[AIレスポンス] --> B{recordType}
    B -->|通常| C[REQUIRED_FIELDS<br/>normal]
    B -->|精神科| D[REQUIRED_FIELDS<br/>psychiatry]

    C --> E[通常フィールド<br/>マッピング]
    D --> F[精神科フィールド<br/>マッピング]

    E --> G[APPSHEET_FIELD_MAPPING<br/>normal]
    F --> H[APPSHEET_FIELD_MAPPING<br/>psychiatry]

    G --> I[データ変換]
    H --> I

    I --> J{データ型}
    J -->|配列| K[カンマ区切り文字列]
    J -->|オブジェクト| L[JSON文字列化]
    J -->|その他| M[そのまま]

    K --> N[AppSheetペイロード]
    L --> N
    M --> N

    N --> O[updateRow API呼び出し]

    style I fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style O fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
```

## エラーハンドリングフロー

```mermaid
flowchart TD
    A[エラー発生] --> B{エラー種別}

    B -->|パラメータエラー| C[ERROR_CODE.MISSING_REQUIRED_PARAMS]
    B -->|ファイルエラー| D[ERROR_CODE.FILE_NOT_FOUND]
    B -->|AI処理エラー| E[ERROR_CODE.VERTEX_AI_ERROR/<br/>GEMINI_API_ERROR]
    B -->|APIエラー| F[ERROR_CODE.APPSHEET_API_ERROR]
    B -->|その他| G[ERROR_CODE.UNEXPECTED_ERROR]

    C --> H[エラーログ記録]
    D --> H
    E --> H
    F --> H
    G --> H

    H --> I{recordNoteId<br/>あり?}
    I -->|あり| J[AppSheetにエラー記録]
    I -->|なし| K[ログのみ]

    J --> L[エラーメール送信]
    K --> M[エラーレスポンス返却]
    L --> M

    style H fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style J fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Idle: システム待機
    Idle --> Receiving: Webhook受信
    Receiving --> Validating: パラメータ検証

    Validating --> Error: 検証失敗
    Validating --> TypeDetermining: 検証成功

    TypeDetermining --> NormalProcessing: 通常記録
    TypeDetermining --> PsychiatryProcessing: 精神科記録

    NormalProcessing --> FileCheck: マスターデータ取得
    PsychiatryProcessing --> FileCheck

    FileCheck --> AudioProcessing: ファイルあり
    FileCheck --> AIProcessing: ファイルなし

    AudioProcessing --> CloudUpload: Drive取得
    CloudUpload --> AIProcessing: アップロード完了

    AIProcessing --> VertexAI: vertex-aiモード
    AIProcessing --> GeminiAPI: fallbackモード

    VertexAI --> ResponseParse: AI応答
    GeminiAPI --> ResponseParse

    ResponseParse --> FieldMapping: JSON解析
    FieldMapping --> AppSheetUpdate: マッピング完了

    AppSheetUpdate --> Cleanup: 更新成功
    AppSheetUpdate --> Error: 更新失敗

    Cleanup --> Success: クリーンアップ完了

    Success --> Logging: 成功ログ記録
    Error --> Logging: エラーログ記録

    Logging --> [*]: 処理完了

    note right of TypeDetermining
        recordTypeパラメータ
        デフォルト: 通常
    end note

    note right of AIProcessing
        Gemini 2.5-pro使用
        temperature: 0.2-0.3
    end note
```

## テスト実行フロー

```mermaid
flowchart LR
    A[testNormalRecord] --> B[デフォルト引数<br/>設定済み]
    C[testPsychiatryRecord] --> D[デフォルト引数<br/>設定済み]
    E[testCustomRecord] --> F[カスタム引数<br/>指定可能]

    B --> G[processRequest呼び出し]
    D --> G
    F --> G

    G --> H[実際の処理実行]
    H --> I[コンソールログ出力]
    I --> J[結果確認]

    style A fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style C fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style E fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
```

## コンポーネント構成図

```mermaid
graph TB
    subgraph "エントリーポイント"
        A[main.gs::doPost]
        B[main.gs::processRequest]
    end

    subgraph "共通モジュール"
        C[共通モジュール/CommonWebhook]
        D[共通モジュール/CommonTest]
    end

    subgraph "設定"
        E[config_settings.gs]
        F[utils_constants.gs]
    end

    subgraph "AI処理"
        G[modules_aiProcessor.gs]
        G1[callVertexAIWithPrompt]
        G2[callGeminiAPIWithPrompt]
        G3[buildNormalPrompt]
        G4[buildPsychiatryPrompt]
    end

    subgraph "データアクセス"
        H[modules_dataAccess.gs]
        I[modules_fileHandler.gs]
    end

    subgraph "AppSheet連携"
        J[modules_appsheetClient.gs]
    end

    subgraph "ユーティリティ"
        K[utils_validators.gs]
        L[utils_errorHandler.gs]
        M[utils_logger.gs]
    end

    subgraph "テスト"
        N[testNormalRecord]
        O[testPsychiatryRecord]
        P[testCustomRecord]
    end

    A --> C
    C --> B
    B --> E
    B --> K
    B --> G
    B --> H
    B --> I
    B --> J

    G --> G1
    G --> G2
    G --> G3
    G --> G4

    N --> B
    O --> B
    P --> B

    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style E fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style F fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style G fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style G1 fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style G2 fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style H fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style I fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style J fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    style K fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style L fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style M fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style N fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style O fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    style P fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
```

## 使用例

### 正常フロー（通常記録）

1. AppSheetから通常記録Webhookを送信
2. `doPost`でリクエスト受信
3. `processRequest`で記録タイプ判定（通常）
4. マスターデータ取得
5. Vertex AIで記録生成（gemini-2.5-pro）
6. フィールドマッピング（通常記録フィールド）
7. AppSheetのCare_Recordsテーブル更新
8. 成功ログ記録・レスポンス返却

### 正常フロー（精神科記録 + 音声）

1. AppSheetから精神科記録Webhookを送信（fileId付き）
2. `doPost`でリクエスト受信
3. `processRequest`で記録タイプ判定（精神科）
4. マスターデータ取得
5. DriveからfileId音声ファイル取得
6. Cloud Storageにアップロード
7. Vertex AIで記録生成（gsUri + 精神科プロンプト）
8. フィールドマッピング（精神科フィールド）
9. AppSheet更新
10. Cloud Storageファイル削除
11. 成功ログ記録・レスポンス返却

### エラーフロー

1. AppSheetからWebhook送信
2. パラメータ検証失敗（必須項目不足）
3. エラーログ記録
4. AppSheetにエラーステータス記録
5. エラーメール送信
6. エラーレスポンス返却

## パフォーマンス考慮

### 処理時間の目安

- **テキストのみ（通常）**: 約3-5秒
- **テキストのみ（精神科）**: 約3-5秒
- **音声あり（通常）**: 約15-30秒
- **音声あり（精神科）**: 約15-30秒

### 最適化ポイント

1. **マスターデータキャッシュ**: `getGuidanceMasterCached()`で1時間キャッシュ
2. **並列処理**: 独立した処理は並列実行
3. **Cloud Storage自動クリーンアップ**: 処理後即座に削除
4. **リトライ戦略**: Vertex AIエラー時の指数バックオフ（30秒、1分、2分）
