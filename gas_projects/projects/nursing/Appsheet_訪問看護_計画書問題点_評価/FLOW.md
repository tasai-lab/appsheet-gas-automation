# Appsheet_訪問看護_計画書問題点_評価 - 処理フロー図

本ドキュメントでは、看護計画問題点評価システムの処理フローを図解します。

## 1. メイン処理フロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([Webhook受信<br/>problemId, planText等]):::webhook --> Validate{パラメータ検証}:::decision

    Validate -->|不足| Error1[エラー応答]:::error
    Validate -->|OK| Handler[CommonWebhook.handleDoPost]:::process

    Handler --> DupCheck{重複チェック}:::decision

    DupCheck -->|重複| Skip[スキップ応答]:::skip
    DupCheck -->|新規| Lock[処理中に設定]:::process

    Lock --> CallGemini[Vertex AI呼び出し<br/>評価文生成]:::gemini

    CallGemini --> Parse[JSONレスポンス解析<br/>evaluationText抽出]:::process

    Parse --> UpdateAppSheet[AppSheet API呼び出し<br/>VN_Plan_Problems更新]:::appsheet

    UpdateAppSheet --> Log[実行ログ記録]:::log

    Log --> Complete[処理完了マーク]:::process
    Complete --> Success([成功応答]):::success

    CallGemini -->|失敗| Error2[エラー処理]:::error
    UpdateAppSheet -->|失敗| Error2
    Error2 --> ErrorLog[エラーログ記録]:::log
    ErrorLog --> ErrorEnd([エラー応答]):::error

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef decision fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef gemini fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    classDef appsheet fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#ffffff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#ffffff
    classDef skip fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
```

## 2. Vertex AI評価生成フロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([看護計画<br/>最新記録受信]):::input --> BuildPrompt[プロンプト生成<br/>評価指示含む]:::process

    BuildPrompt --> Config[generationConfig設定<br/>JSON形式・temperature 0.2]:::process

    Config --> API[Vertex AI API呼び出し<br/>gemini-2.5-pro]:::gemini

    API --> Response{APIレスポンス}:::decision

    Response -->|200 OK| Extract[JSONレスポンス抽出<br/>candidates[0].content.parts[0].text]:::process
    Response -->|エラー| APIError[APIエラー]:::error

    Extract --> JSONParse[JSON範囲特定<br/>最初の\{から最後の\}]:::process

    JSONParse --> Parse{JSON解析}:::decision

    Parse -->|成功| Validate{評価文検証}:::decision
    Parse -->|失敗| ParseError[JSON解析エラー]:::error

    Validate -->|OK| Result([evaluationText返却<br/>50文字未満]):::success
    Validate -->|NG| ValidateError[データ不正]:::error

    APIError --> ErrorEnd([エラー]):::error
    ParseError --> ErrorEnd
    ValidateError --> ErrorEnd

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef decision fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef gemini fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#ffffff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#ffffff
```

## 3. AppSheet更新フロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([評価文<br/>problemId受信]):::input --> DateTime[日時情報生成<br/>evaluation_date<br/>updated_at]:::process

    DateTime --> BuildPayload[ペイロード作成<br/>Edit Action]:::process

    BuildPayload --> Payload[Rows配列作成<br/>問題ID・評価文・ステータス等]:::process

    Payload --> API[AppSheet API呼び出し<br/>VN_Plan_Problems/Action]:::appsheet

    API --> Response{APIレスポンス}:::decision

    Response -->|200 OK| Success([更新成功]):::success
    Response -->|400+| Error[APIエラーログ]:::error

    Error --> ErrorEnd([エラー]):::error

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef decision fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef appsheet fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#ffffff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#ffffff
```

## 4. 重複防止フロー

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    participant AS as AppSheet
    participant GAS as doPost
    participant Common as CommonWebhook
    participant Dup as DuplicationPrevention
    participant Cache as CacheService
    participant Lock as LockService
    participant Proc as processRequest

    AS->>GAS: POST Request (problemId等)
    GAS->>Common: handleDoPost(e, processFunction)
    Common->>Common: JSONパース

    alt 重複防止が有効
        Common->>Dup: isAlreadyProcessed(problemId)
        Dup->>Cache: キャッシュ確認

        alt キャッシュにあり
            Cache-->>Dup: 処理済み
            Dup-->>Common: true
            Common-->>AS: 重複スキップレスポンス
        else キャッシュになし
            Cache-->>Dup: 未処理
            Dup->>Lock: ロック取得
            Lock-->>Dup: ロック成功
            Dup->>Cache: 再度確認

            alt 再確認で処理済み
                Cache-->>Dup: 処理済み
                Dup->>Lock: ロック解放
                Dup-->>Common: true
                Common-->>AS: 重複スキップレスポンス
            else 再確認で未処理
                Cache-->>Dup: 未処理
                Dup->>Cache: 処理中マーク設定
                Dup-->>Common: false
                Common->>Proc: processRequest実行
                Proc-->>Common: 処理結果
                Common->>Dup: markAsCompleted
                Dup->>Cache: 処理完了マーク
                Dup->>Lock: ロック解放
                Common-->>AS: 成功レスポンス
            end
        end
    else 重複防止が無効
        Common->>Proc: processRequest実行
        Proc-->>Common: 処理結果
        Common-->>AS: レスポンス
    end
```

## 5. エラーハンドリングフロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([処理開始]):::start --> Try[Try Block開始]:::process

    Try --> Validate{パラメータ検証}:::decision

    Validate -->|OK| Generate[評価文生成]:::process
    Validate -->|NG| ParamError[パラメータエラー]:::error

    Generate --> Update[AppSheet更新]:::process

    Update --> Log[ログ記録]:::log
    Log --> Success([成功]):::success

    Generate -->|例外| Catch[Catch Block]:::error
    Update -->|例外| Catch

    Catch --> ErrorInfo[エラー情報取得<br/>message, stack]:::process
    ErrorInfo --> ErrorLog[エラーログ記録<br/>logger.error]:::log
    ErrorLog --> ErrorEnd([エラー終了]):::error

    ParamError --> Catch

    classDef start fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef decision fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#ffffff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#ffffff
```

## 6. 実行ログ記録フロー

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    participant Script as processRequest
    participant Logger as GASLogger
    participant Sheet as 統合コスト管理シート

    Script->>Logger: createLogger('計画書問題点_評価')
    Logger->>Logger: ロガー初期化（startTime, requestId）

    Script->>Logger: info('処理開始')
    Logger->>Logger: ログ配列に追加

    alt 正常処理
        Script->>Logger: success('処理完了')
        Logger->>Logger: ログ配列に追加
        Script->>Logger: saveToSpreadsheet('成功', problemId)
    else エラー発生
        Script->>Logger: error('エラー発生', errorDetails)
        Logger->>Logger: ログ配列に追加
        Script->>Logger: saveToSpreadsheet('エラー', problemId)
    end

    Logger->>Sheet: スプレッドシート取得/作成
    Sheet-->>Logger: シート参照

    Logger->>Logger: ログデータ作成<br/>37列のデータ配列

    Logger->>Sheet: appendRow(logData)
    Sheet-->>Logger: 追加完了

    Logger->>Sheet: 詳細ログシートに追加（オプション）
    Sheet-->>Logger: 完了

    Logger-->>Script: 保存完了
```

## 7. 状態遷移図

```mermaid
%%{init: {'theme':'dark'}}%%
stateDiagram-v2
    [*] --> Idle: システム待機
    Idle --> Receiving: Webhook受信
    Receiving --> Validating: データ検証

    Validating --> Error: 検証失敗
    Validating --> Checking: 検証成功

    Checking --> Duplicate: 重複検出
    Checking --> Processing: 新規リクエスト

    Duplicate --> Logging: 警告ログ
    Processing --> GeneratingEvaluation: AI評価生成

    GeneratingEvaluation --> UpdatingAppSheet: 処理成功
    GeneratingEvaluation --> Error: 処理失敗

    UpdatingAppSheet --> Success: API成功
    UpdatingAppSheet --> Error: API失敗

    Success --> Logging
    Error --> Logging

    Logging --> Responding: レスポンス生成
    Responding --> [*]: 処理完了

    note right of GeneratingEvaluation
        Vertex AI Gemini 2.5 Pro
        temperature: 0.2
        JSON形式レスポンス
    end note

    note right of UpdatingAppSheet
        AppSheet API
        Edit Action
        VN_Plan_Problems
    end note
```

## 8. モジュール構成図

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    subgraph "エントリーポイント"
        doPost[doPost]:::webhook
        testFunc[testProcessRequest]:::test
    end

    subgraph "共通Webhookハンドラー"
        common[CommonWebhook.handleDoPost]:::common
    end

    subgraph "メイン処理"
        main[processRequest]:::main
        generate[generateEvaluationWithGemini]:::main
        update[updateEvaluationInAppSheet]:::main
    end

    subgraph "Vertex AI連携"
        vertexApi[Vertex AI API]:::gemini
    end

    subgraph "AppSheet連携"
        appsheetApi[AppSheet API]:::appsheet
    end

    subgraph "共通モジュール"
        logger[GASLogger]:::log
        dup[DuplicationPrevention]:::dup
        geminiClient[GeminiClient]:::log
        scriptProps[ScriptPropertiesManager]:::log
        utilsDup[utils_duplicationPrevention]:::dup
    end

    doPost --> common
    testFunc --> main

    common --> dup
    common --> logger
    common --> main

    main --> generate
    main --> update

    generate --> vertexApi
    update --> appsheetApi

    main --> logger
    generate --> logger
    update --> logger

    dup --> utilsDup
    dup --> scriptProps

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef test fill:#5f1e3a,stroke:#e24a90,stroke-width:2px,color:#ffffff
    classDef common fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef main fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef gemini fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    classDef appsheet fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#ffffff
    classDef dup fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
```

## 9. データフロー詳細

```mermaid
%%{init: {'theme':'dark'}}%%
graph LR
    A[Webhook Data]:::input --> B[JSON Parse]:::process
    B --> C[パラメータ抽出]:::process

    C --> D[看護計画テキスト]:::data
    C --> E[最新看護記録]:::data
    C --> F[その他パラメータ]:::data

    D --> G[プロンプト構築]:::process
    E --> G
    F --> G

    G --> H[Vertex AI API]:::gemini

    H --> I[JSON評価文]:::data

    I --> J[評価文抽出]:::process

    J --> K[AppSheet更新データ]:::data
    F --> K

    K --> L[AppSheet API]:::appsheet

    L --> M[更新完了]:::result

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#ffffff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#ffffff
    classDef data fill:#2d4a4a,stroke:#6dd6d6,stroke-width:2px,color:#ffffff
    classDef gemini fill:#4a1e5f,stroke:#b84ae2,stroke-width:2px,color:#ffffff
    classDef appsheet fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#ffffff
    classDef result fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#ffffff
```

## 10. タイミング図

```mermaid
%%{init: {'theme':'dark'}}%%
gantt
    title 処理タイミング（標準実行時）
    dateFormat  HH:mm:ss.SSS
    axisFormat  %S.%L秒

    section リクエスト受信
    Webhook受信           :a1, 00:00:00.000, 10ms
    JSONパース            :a2, after a1, 20ms

    section 重複チェック
    キャッシュ確認        :b1, after a2, 50ms
    ロック取得            :b2, after b1, 100ms

    section AI評価生成
    プロンプト構築        :c1, after b2, 100ms
    Vertex AI API呼び出し :c2, after c1, 3000ms
    JSON解析              :c3, after c2, 50ms

    section AppSheet更新
    ペイロード構築        :d1, after c3, 50ms
    AppSheet API呼び出し  :d2, after d1, 500ms

    section ログ記録
    ログデータ作成        :e1, after d2, 50ms
    スプレッドシート書込  :e2, after e1, 200ms

    section レスポンス
    レスポンス生成        :f1, after e2, 20ms
```

## 使用例

### 正常フロー

1. AppSheetからWebhook送信（problemId, planText, latestRecords等）
2. doPost関数でリクエスト受信
3. 重複チェック（初回なのでパス）
4. Vertex AI APIで評価文生成
5. AppSheet VN_Plan_Problemsテーブル更新
6. 成功ログ記録
7. 成功レスポンス返却

### 重複検出フロー

1. AppSheetから同じproblemIdで2回送信
2. 1回目: 正常処理
3. 2回目: キャッシュで重複検出
4. 警告ログ記録
5. スキップレスポンス返却

### エラーフロー

1. AppSheetからWebhook送信
2. Vertex AI API呼び出し中にエラー
3. Catchブロックでエラー捕捉
4. エラーログ記録（詳細とスタックトレース）
5. エラーレスポンス返却

---

**最終更新**: 2025-10-23
**バージョン**: v2.1.0
