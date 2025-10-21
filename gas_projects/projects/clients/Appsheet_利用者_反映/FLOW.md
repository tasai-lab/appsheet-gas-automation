# Appsheet_利用者_反映 - フロー図

## システムフロー図

### メイン処理フロー

```mermaid
flowchart TD
    Start([AppSheet Webhook]) -->|POST Request| DoPost[doPost]
    DoPost --> CommonWebhook[CommonWebhook.handleDoPost]
    CommonWebhook --> Parse{JSONパース}

    Parse -->|成功| DupCheck{重複チェック}
    Parse -->|失敗| LogError1[エラーログ記録]
    LogError1 --> ErrorResp1[エラーレスポンス返却]

    DupCheck -->|重複あり| LogWarn[警告ログ記録]
    LogWarn --> DupResp[重複レスポンス返却]

    DupCheck -->|重複なし| ProcessReq[processRequest]

    ProcessReq --> ValidateParams{必須パラメータ<br/>チェック}
    ValidateParams -->|NG| ThrowError1[エラー発生]

    ValidateParams -->|OK| GetClientId[getNewClientId]
    GetClientId --> AppSheetFind[AppSheet API: Find]
    AppSheetFind --> CalcId[ID採番<br/>CL-00XXX]

    CalcId --> ExtractInfo[extractClientInfoWithGemini]
    ExtractInfo --> BuildPrompt[プロンプト生成]
    BuildPrompt --> CheckFile{添付資料<br/>あり?}

    CheckFile -->|あり| LoadFile[Driveからファイル取得]
    LoadFile --> Base64[base64エンコード]
    Base64 --> VertexAI

    CheckFile -->|なし| VertexAI[Vertex AI API呼び出し]
    VertexAI --> ParseJSON[JSON応答パース]

    ParseJSON --> CreateClient[createClientInAppSheet]
    CreateClient --> CalcAge[年齢計算]
    CalcAge --> AppSheetAdd[AppSheet API: Add]

    AppSheetAdd --> UpdateStatus[updateRequestStatus]
    UpdateStatus --> AppSheetEdit[AppSheet API: Edit<br/>status=反映済み]

    AppSheetEdit --> LogSuccess[成功ログ記録]
    LogSuccess --> SuccessResp[成功レスポンス返却]

    ThrowError1 --> CatchError[Catchブロック]
    ExtractInfo -.エラー.-> CatchError
    CreateClient -.エラー.-> CatchError
    UpdateStatus -.エラー.-> CatchError

    CatchError --> LogError2[エラーログ記録]
    LogError2 --> UpdateError[updateRequestStatus<br/>status=エラー]
    UpdateError --> ErrorResp2[エラーレスポンス返却]

    ErrorResp1 --> End([処理終了])
    DupResp --> End
    SuccessResp --> End
    ErrorResp2 --> End

    style Start fill:#e1f5ff
    style DoPost fill:#fff9c4
    style ProcessReq fill:#c8e6c9
    style VertexAI fill:#ffccbc
    style AppSheetFind fill:#f8bbd0
    style AppSheetAdd fill:#f8bbd0
    style AppSheetEdit fill:#f8bbd0
    style LogSuccess fill:#c8e6c9
    style LogError2 fill:#ffcdd2
    style End fill:#e1f5ff
```

## 重複防止フロー

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant GAS as doPost
    participant CommonWH as CommonWebhook
    participant DupPrev as DuplicationPrevention
    participant Props as ScriptProperties
    participant Lock as LockService
    participant Log as ExecutionLogger

    AS->>GAS: POST Request
    GAS->>CommonWH: handleDoPost(e, callback)
    CommonWH->>CommonWH: リクエストペイロードからハッシュ生成
    CommonWH->>DupPrev: executeWithRetry()

    DupPrev->>Props: ScriptProperties確認

    alt プロパティに処理済みマークあり
        Props-->>DupPrev: 処理済み
        DupPrev->>Log: 重複ログ記録
        DupPrev-->>CommonWH: isDuplicate=true
        CommonWH-->>AS: 重複レスポンス
    else プロパティに未処理
        Props-->>DupPrev: 未処理
        DupPrev->>Lock: ロック取得
        Lock-->>DupPrev: ロック成功

        DupPrev->>Props: 再度確認（ダブルチェック）

        alt 再確認で処理済み
            Props-->>DupPrev: 処理済み
            DupPrev->>Lock: ロック解放
            DupPrev->>Log: 重複ログ記録
            DupPrev-->>CommonWH: isDuplicate=true
            CommonWH-->>AS: 重複レスポンス
        else 再確認で未処理
            Props-->>DupPrev: 未処理
            DupPrev->>Props: 処理済みマーク設定（24時間TTL）
            DupPrev->>DupPrev: processRequest実行
            DupPrev->>Log: 成功/エラーログ記録
            DupPrev->>Lock: ロック解放
            DupPrev-->>CommonWH: isDuplicate=false
            CommonWH-->>AS: 処理結果レスポンス
        end
    end
```

## Vertex AI情報抽出フロー

```mermaid
flowchart TD
    Start([extractClientInfoWithGemini]) --> BuildPrompt[プロンプト生成<br/>医療事務スタッフロール]
    BuildPrompt --> AddText[テキストパート追加<br/>clientInfoTemp + requestReason]

    AddText --> CheckFile{添付資料<br/>fileId指定?}

    CheckFile -->|あり| GetFile[DriveApp.getFileById]
    GetFile --> GetBlob[ファイルBlob取得]
    GetBlob --> Base64[base64エンコード]
    Base64 --> AddInline[inlineDataパート追加<br/>mimeType + data]
    AddInline --> BuildReq

    CheckFile -->|なし| BuildReq[リクエストボディ構築]

    BuildReq --> SetConfig[generationConfig設定<br/>responseMimeType: application/json<br/>temperature: 0.1<br/>maxOutputTokens: 8192]

    SetConfig --> BuildURL[エンドポイントURL構築<br/>us-central1-aiplatform.googleapis.com]

    BuildURL --> GetToken[OAuth2トークン取得<br/>ScriptApp.getOAuthToken]

    GetToken --> CallAPI[UrlFetchApp.fetch<br/>POST リクエスト]

    CallAPI --> CheckStatus{レスポンス<br/>コード?}

    CheckStatus -->|200| ParseResp[JSON応答パース]
    CheckStatus -->|!= 200| LogAPIError[APIエラーログ記録]
    LogAPIError --> ThrowError1[エラー発生]

    ParseResp --> CheckCandidates{candidates<br/>存在?}

    CheckCandidates -->|なし| ThrowError2[エラー発生:<br/>候補なし]

    CheckCandidates -->|あり| CheckFinish{finishReason?}

    CheckFinish -->|MAX_TOKENS| ThrowError3[エラー発生:<br/>トークン制限]

    CheckFinish -->|STOP/その他| CheckContent{content.parts<br/>存在?}

    CheckContent -->|なし| ThrowError4[エラー発生:<br/>コンテンツなし]

    CheckContent -->|あり| ExtractText[parts[0].text取得]

    ExtractText --> ParseJSON[JSONパース]

    ParseJSON --> Return[利用者情報オブジェクト返却]

    ThrowError1 --> End([エラー終了])
    ThrowError2 --> End
    ThrowError3 --> End
    ThrowError4 --> End
    ParseJSON -.JSON不正.-> End
    Return --> Success([正常終了])

    style Start fill:#e1f5ff
    style CallAPI fill:#ffccbc
    style ParseJSON fill:#c8e6c9
    style Return fill:#c8e6c9
    style Success fill:#c8e6c9
    style ThrowError1 fill:#ffcdd2
    style ThrowError2 fill:#ffcdd2
    style ThrowError3 fill:#ffcdd2
    style ThrowError4 fill:#ffcdd2
    style End fill:#ffcdd2
```

## データフロー図

```mermaid
flowchart LR
    WebhookData[Webhook Data] --> ParseJSON[JSON Parse]
    ParseJSON --> ReqParams[Request Parameters<br/>requestId<br/>clientInfoTemp<br/>requestReason<br/>documentFileId<br/>staffId<br/>providerOffice]

    ReqParams --> Process{処理分岐}

    Process --> IDGen[ID採番]
    IDGen --> ASFind[AppSheet API: Find]
    ASFind --> ClientCount[既存利用者数取得]
    ClientCount --> NewID[新ID生成<br/>CL-00XXX]

    Process --> AIExtract[AI情報抽出]
    AIExtract --> VertexAI[Vertex AI API]
    VertexAI --> ExtractedInfo[抽出情報<br/>氏名・生年月日<br/>性別・電話番号<br/>要介護度など]

    ExtractedInfo --> AgeCalc[年齢計算]
    AgeCalc --> ClientData[利用者データ]

    NewID --> ClientData
    ReqParams --> ClientData

    ClientData --> ASAdd[AppSheet API: Add]
    ASAdd --> ClientsTable[(Clientsテーブル)]

    ReqParams --> StatusUpdate[ステータス更新]
    StatusUpdate --> ASEdit[AppSheet API: Edit]
    ASEdit --> RequestsTable[(Client_Requestsテーブル)]

    Process --> Logging[ログ記録]
    Logging --> LogSheet[(実行ログスプレッドシート)]

    style WebhookData fill:#e1f5ff
    style VertexAI fill:#ffccbc
    style ASFind fill:#f8bbd0
    style ASAdd fill:#f8bbd0
    style ASEdit fill:#f8bbd0
    style ClientsTable fill:#fff9c4
    style RequestsTable fill:#fff9c4
    style LogSheet fill:#fff9c4
```

## エラーハンドリングフロー

```mermaid
flowchart TD
    TryStart([Try Block開始]) --> Execute[処理実行]

    Execute --> Check{エラー<br/>発生?}

    Check -->|なし| Success[正常処理完了]
    Success --> LogSuccess[成功ログ記録]
    LogSuccess --> UpdateSuccess[依頼ステータス更新<br/>status=反映済み]
    UpdateSuccess --> SaveLog[実行時間記録]
    SaveLog --> RetSuccess[成功レスポンス]

    Check -->|あり| Catch[Catch Block]
    Catch --> GetError[エラー情報取得<br/>message, stack]
    GetError --> LogError[エラーログ記録]
    LogError --> UpdateError[依頼ステータス更新<br/>status=エラー<br/>error_details設定]
    UpdateError --> SaveLogError[実行時間記録]
    SaveLogError --> RetError[エラーレスポンス]

    RetSuccess --> Finally[Finally Block]
    RetError --> Finally

    Finally --> CleanupLock[ロック解放]
    CleanupLock --> End([処理終了])

    style TryStart fill:#e1f5ff
    style Success fill:#c8e6c9
    style LogSuccess fill:#c8e6c9
    style Catch fill:#ffcdd2
    style LogError fill:#ffcdd2
    style UpdateError fill:#ffcdd2
    style End fill:#e1f5ff
```

## AppSheet API連携フロー

```mermaid
sequenceDiagram
    participant Script as processRequest
    participant IDGen as getNewClientId
    participant ASFind as AppSheet API (Find)
    participant Create as createClientInAppSheet
    participant ASAdd as AppSheet API (Add)
    participant Update as updateRequestStatus
    participant ASEdit as AppSheet API (Edit)

    Script->>IDGen: 新しいClientIDを採番
    IDGen->>ASFind: Find Action<br/>Clientsテーブル
    ASFind-->>IDGen: 既存利用者一覧（JSON配列）
    IDGen->>IDGen: 利用者数カウント + 1
    IDGen->>IDGen: CL-00XXX形式でID生成
    IDGen-->>Script: newClientId

    Script->>Script: extractClientInfoWithGemini
    Script-->>Script: extractedInfo

    Script->>Create: createClientInAppSheet
    Create->>Create: calculateAge(birth_date)
    Create->>Create: rowData構築
    Create->>ASAdd: Add Action<br/>Clientsテーブル<br/>Rows: [rowData]
    ASAdd-->>Create: 成功レスポンス
    Create-->>Script: 完了

    Script->>Update: updateRequestStatus<br/>status=反映済み
    Update->>Update: rowData構築
    Update->>ASEdit: Edit Action<br/>Client_Requestsテーブル<br/>Rows: [rowData]
    ASEdit-->>Update: 成功レスポンス
    Update-->>Script: 完了

    Script-->>Script: 処理完了
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Idle: システム待機
    Idle --> Receiving: Webhook受信
    Receiving --> Parsing: データパース

    Parsing --> ValidationError: パース失敗
    Parsing --> DuplicationCheck: パース成功

    DuplicationCheck --> Duplicate: 重複検出
    DuplicationCheck --> Processing: 新規リクエスト

    Duplicate --> LoggingDup: 警告ログ
    Processing --> Validating: パラメータ検証

    Validating --> ValidationError: 必須項目不足
    Validating --> IDGeneration: 検証成功

    IDGeneration --> AppSheetFindAPI: AppSheet API呼び出し
    AppSheetFindAPI --> APIError: API失敗
    AppSheetFindAPI --> AIExtraction: ID採番成功

    AIExtraction --> VertexAIAPI: Vertex AI API呼び出し
    VertexAIAPI --> APIError: API失敗
    VertexAIAPI --> ClientCreation: 情報抽出成功

    ClientCreation --> AppSheetAddAPI: AppSheet API呼び出し
    AppSheetAddAPI --> APIError: API失敗
    AppSheetAddAPI --> StatusUpdate: 利用者作成成功

    StatusUpdate --> AppSheetEditAPI: AppSheet API呼び出し
    AppSheetEditAPI --> APIError: API失敗
    AppSheetEditAPI --> Success: ステータス更新成功

    Success --> LoggingSuccess: 成功ログ
    ValidationError --> LoggingError: エラーログ
    APIError --> LoggingError

    LoggingDup --> Responding: レスポンス生成
    LoggingSuccess --> Responding
    LoggingError --> Responding

    Responding --> [*]: 処理完了

    note right of DuplicationCheck
        ScriptProperties
        24時間TTL
        LockService使用
    end note

    note right of VertexAIAPI
        Gemini 2.5 Pro
        OAuth2認証
        JSON構造化レスポンス
    end note
```

## タイミング図

```mermaid
gantt
    title 利用者反映処理タイミング（想定）
    dateFormat  HH:mm:ss.SSS
    axisFormat  %S.%L秒

    section リクエスト受信
    Webhook受信           :a1, 00:00:00.000, 50ms
    JSONパース            :a2, after a1, 50ms

    section 重複チェック
    ハッシュ生成          :b1, after a2, 50ms
    ScriptProperties確認  :b2, after b1, 100ms
    ロック取得            :b3, after b2, 50ms

    section ID採番
    AppSheet API Find     :c1, after b3, 800ms
    ID計算                :c2, after c1, 50ms

    section AI情報抽出
    プロンプト生成        :d1, after c2, 100ms
    ファイル取得          :d2, after d1, 300ms
    Vertex AI API         :d3, after d2, 3500ms
    JSON解析              :d4, after d3, 100ms

    section 利用者作成
    年齢計算              :e1, after d4, 50ms
    AppSheet API Add      :e2, after e1, 700ms

    section ステータス更新
    AppSheet API Edit     :f1, after e2, 600ms

    section ログ記録
    ログ記録              :g1, after f1, 300ms

    section レスポンス
    レスポンス生成        :h1, after g1, 50ms
```

## コンポーネント図

```mermaid
graph TB
    subgraph "AppSheet"
        A[Client_Requests Workflow]
        B[Clientsテーブル]
        C[Client_Requestsテーブル]
    end

    subgraph "Google Apps Script"
        D[doPost Handler]
        E[CommonWebhook]
        F[processRequest]
        G[DuplicationPrevention]
        H[ExecutionLogger]
        I[getNewClientId]
        J[extractClientInfoWithGemini]
        K[createClientInAppSheet]
        L[updateRequestStatus]
    end

    subgraph "Google Services"
        M[ScriptProperties]
        N[LockService]
        O[SpreadsheetApp]
        P[DriveApp]
    end

    subgraph "External APIs"
        Q[Vertex AI API<br/>Gemini 2.5 Pro]
        R[AppSheet API]
    end

    A -->|Webhook| D
    D --> E
    E --> G
    E --> F
    F --> I
    F --> J
    F --> K
    F --> L
    F --> H

    G --> M
    G --> N
    H --> O
    J --> P
    J --> Q
    I --> R
    K --> R
    L --> R

    R --> B
    R --> C

    style D fill:#fff9c4
    style E fill:#fff9c4
    style F fill:#c8e6c9
    style G fill:#e1bee7
    style H fill:#e1bee7
    style Q fill:#ffccbc
    style R fill:#f8bbd0
```

## 使用例

### 正常フロー

1. AppSheetで新しい依頼を作成（依頼ID: CR-00123）
2. Webhookが自動トリガー
3. doPost関数でリクエスト受信
4. 重複チェック（初回なのでパス）
5. 既存利用者数を取得してID採番（CL-00456）
6. Vertex AIで利用者情報を抽出
7. Clientsテーブルに新規レコード追加
8. 依頼のステータスを「反映済み」に更新
9. 成功ログ記録
10. 成功レスポンス返却

### 重複検出フロー

1. AppSheetから同じ依頼ID（CR-00123）で2回Webhook送信
2. 1回目: 正常処理（ScriptPropertiesに処理済みマーク）
3. 2回目: ScriptPropertiesで重複検出
4. 警告ログ記録
5. 重複レスポンス返却（処理スキップ）

### エラーフロー（Vertex AIエラー）

1. AppSheetからWebhook送信
2. ID採番成功
3. Vertex AI呼び出し → API認証エラー
4. Catchブロックでエラー捕捉
5. エラーログ記録（スタックトレース含む）
6. 依頼ステータスを「エラー」に更新（error_details設定）
7. エラーレスポンス返却

### 添付資料ありフロー

1. AppSheetから依頼を作成（documentFileId指定）
2. Webhook受信
3. ID採番
4. DriveからファイルID指定でファイル取得
5. Blobをbase64エンコード
6. Vertex AIにテキスト + inlineDataで送信
7. AIが添付資料（PDF/画像）も含めて情報抽出
8. 以降は通常フロー
