# AppSheetSecureConnector - フロー図

## システムフロー図

### メイン処理フロー

```mermaid
flowchart TD
    A[AppSheet Webhook] -->|POST Request| B[doPost]
    B --> C{JSONパース}
    C -->|成功| D[リクエストID生成]
    C -->|失敗| E[エラーログ記録]
    E --> F[エラーレスポンス返却]

    D --> G{重複チェック}
    G -->|重複あり| H[警告ログ記録]
    H --> I[スキップレスポンス返却]

    G -->|重複なし| J[キャッシュに処理済みマーク]
    J --> K[ビジネスロジック実行]

    K -->|成功| L[成功ログ記録]
    K -->|エラー| M[エラーログ記録]

    L --> N[成功レスポンス返却]
    M --> F

    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style E fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style F fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style G fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style H fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style I fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style J fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style K fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style L fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style M fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style N fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
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
    D --> E{処理タイプ}

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

    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style E fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style F fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style G fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style H fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style I fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    style J fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style K fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style L fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
```

## エラーハンドリングフロー

```mermaid
flowchart TD
    A[処理開始] --> B[Try Block]
    B --> C{エラー発生?}

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

    style A fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style B fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style D fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style E fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style F fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style G fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style H fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style I fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style J fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style K fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style L fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style M fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style N fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
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

    style A fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style B fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    style C fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style D fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#ffffff
    style E fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    style F fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style G fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style H fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    style I fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    style J fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
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
