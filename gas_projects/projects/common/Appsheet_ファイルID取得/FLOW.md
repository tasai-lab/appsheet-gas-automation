# Appsheet_ファイルID取得 - 処理フロー

## 全体フロー図

```mermaid
graph TB
    Start([開始: Webhook受信]) --> ParseRequest[CommonWebhook:<br/>リクエストパース]
    ParseRequest --> ValidateParams{パラメータ検証}

    ValidateParams -->|不正| ErrorResponse[エラーレスポンス生成]
    ValidateParams -->|正常| CheckFilePathType{filePath の型判定}

    CheckFilePathType -->|String| SingleFileProcess[単一ファイル処理]
    CheckFilePathType -->|Array| MultipleFileProcess[複数ファイル処理]

    SingleFileProcess --> GetFileId[FileIdUtilities:<br/>getFileIdAndUrl]
    GetFileId --> ParsePath[ファイルパス解析]
    ParsePath --> NavigateFolders[フォルダー階層を探索]
    NavigateFolders --> SearchFile{ファイル検索}

    SearchFile -->|見つかった| ReturnFileInfo[ファイルID/URL返却]
    SearchFile -->|見つからない| FileNotFoundError[ファイル未検出エラー]

    ReturnFileInfo --> SingleSuccessResponse[成功レスポンス生成<br/>mode: single]

    MultipleFileProcess --> LoopFiles[ファイルパスをループ]
    LoopFiles --> GetMultipleFileId[FileIdUtilities:<br/>getFileIdAndUrl<br/>各パスに対して実行]
    GetMultipleFileId --> CollectResults{全ファイル処理完了?}

    CollectResults -->|未完了| LoopFiles
    CollectResults -->|完了| AggregateResults[成功/エラー件数集計]
    AggregateResults --> MultipleSuccessResponse[成功レスポンス生成<br/>mode: multiple]

    SingleSuccessResponse --> End([終了: レスポンス返却])
    MultipleSuccessResponse --> End
    FileNotFoundError --> ErrorResponse
    ErrorResponse --> End

    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style End fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style ErrorResponse fill:#ffebee,stroke:#c62828,stroke-width:2px
    style SingleSuccessResponse fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style MultipleSuccessResponse fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style CheckFilePathType fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style SearchFile fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CollectResults fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

## 単一ファイル処理詳細フロー

```mermaid
graph TB
    Start([開始: 単一ファイル処理]) --> ValidateInput{入力パラメータ検証}
    ValidateInput -->|baseFolderId不正| ParamError[パラメータエラー]
    ValidateInput -->|filePath不正| ParamError
    ValidateInput -->|正常| ParseFilePath[ファイルパス解析]

    ParseFilePath --> SplitPath[パスを'/'で分割]
    SplitPath --> ExtractFileName[最後の要素をファイル名として抽出]
    ExtractFileName --> ExtractFolders[残りをフォルダーパスとして保持]

    ExtractFolders --> GetBaseFolder[起点フォルダー取得:<br/>getFolderByIdSafe_]
    GetBaseFolder --> TryStandardAPI{DriveApp.getFolderById}

    TryStandardAPI -->|成功| StartNavigation[フォルダー探索開始]
    TryStandardAPI -->|失敗| TryDriveAPIv3{Drive API v3<br/>supportsAllDrives: true}

    TryDriveAPIv3 -->|成功| StartNavigation
    TryDriveAPIv3 -->|失敗| FolderNotFoundError[フォルダー未検出エラー]

    StartNavigation --> HasMoreFolders{フォルダーパス残存?}
    HasMoreFolders -->|なし| SearchFileInFolder[現在フォルダーでファイル検索]
    HasMoreFolders -->|あり| GetNextFolderName[次のフォルダー名取得]

    GetNextFolderName --> SearchSubFolder{サブフォルダー検索}
    SearchSubFolder -->|見つかった| UpdateCurrentFolder[現在フォルダーを更新]
    SearchSubFolder -->|見つからない| SubFolderNotFoundError[サブフォルダー未検出エラー]

    UpdateCurrentFolder --> HasMoreFolders

    SearchFileInFolder --> FileExists{ファイル存在確認}
    FileExists -->|見つかった| ExtractFileInfo[ファイルID/URL抽出]
    FileExists -->|見つからない| FileNotFoundError[ファイル未検出エラー]

    ExtractFileInfo --> CreateResult[結果オブジェクト生成:<br/>{id, url}]
    CreateResult --> End([終了: 成功])

    ParamError --> EndError([終了: エラー])
    FolderNotFoundError --> EndError
    SubFolderNotFoundError --> EndError
    FileNotFoundError --> EndError

    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style End fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style EndError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style ParamError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style FolderNotFoundError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style SubFolderNotFoundError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style FileNotFoundError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style ValidateInput fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style TryStandardAPI fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style TryDriveAPIv3 fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style HasMoreFolders fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style SearchSubFolder fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style FileExists fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

## 複数ファイル処理詳細フロー

```mermaid
graph TB
    Start([開始: 複数ファイル処理]) --> ValidateArray{filePath が配列?}
    ValidateArray -->|No| TypeError[型エラー]
    ValidateArray -->|Yes| InitResults[結果配列を初期化:<br/>results = []]

    InitResults --> InitCounters[カウンターを初期化:<br/>totalCount = 0<br/>successCount = 0<br/>errorCount = 0]

    InitCounters --> LoopStart{次のファイルパス存在?}
    LoopStart -->|No| AggregateResults[集計結果を生成]
    LoopStart -->|Yes| GetNextPath[次のfilePath取得]

    GetNextPath --> IncrementTotal[totalCount++]
    IncrementTotal --> TryGetFileId[try: getFileIdAndUrl]

    TryGetFileId --> ProcessSuccess{処理成功?}
    ProcessSuccess -->|Yes| IncrementSuccess[successCount++]
    ProcessSuccess -->|No| IncrementError[errorCount++]

    IncrementSuccess --> AddSuccessResult[results に追加:<br/>{path, id, url}]
    IncrementError --> AddErrorResult[results に追加:<br/>{path, id: null,<br/>url: null, error}]

    AddSuccessResult --> LoopStart
    AddErrorResult --> LoopStart

    AggregateResults --> CreateResponse[レスポンス生成:<br/>{success: true,<br/>mode: 'multiple',<br/>totalCount,<br/>successCount,<br/>errorCount,<br/>results}]

    CreateResponse --> End([終了: 成功])
    TypeError --> EndError([終了: エラー])

    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style End fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style EndError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style TypeError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style ValidateArray fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style LoopStart fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style ProcessSuccess fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style IncrementSuccess fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px
    style IncrementError fill:#ffebee,stroke:#c62828,stroke-width:1px
```

## 共有ドライブ対応フロー

```mermaid
graph TB
    Start([フォルダー取得要求]) --> TryDriveApp[DriveApp.getFolderById<br/>試行]

    TryDriveApp --> DriveAppSuccess{成功?}
    DriveAppSuccess -->|Yes| ReturnFolder[フォルダーオブジェクト返却]
    DriveAppSuccess -->|No| CheckDriveAPIv3{Drive API v3<br/>利用可能?}

    CheckDriveAPIv3 -->|No| ThrowError[エラー:<br/>フォルダーが見つかりません]
    CheckDriveAPIv3 -->|Yes| CallDriveAPIv3[Drive.Files.get<br/>supportsAllDrives: true]

    CallDriveAPIv3 --> APISuccess{成功?}
    APISuccess -->|No| ThrowError
    APISuccess -->|Yes| CheckMimeType{mimeType が<br/>フォルダー?}

    CheckMimeType -->|No| ThrowNotFolderError[エラー:<br/>フォルダーではありません]
    CheckMimeType -->|Yes| RetryDriveApp[DriveApp.getFolderById<br/>再試行]

    RetryDriveApp --> ReturnFolder

    ReturnFolder --> End([終了: 成功])
    ThrowError --> EndError([終了: エラー])
    ThrowNotFolderError --> EndError

    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style End fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style EndError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style DriveAppSuccess fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CheckDriveAPIv3 fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style APISuccess fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CheckMimeType fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style ThrowError fill:#ffebee,stroke:#c62828,stroke-width:2px
    style ThrowNotFolderError fill:#ffebee,stroke:#c62828,stroke-width:2px
```

## エラーハンドリングフロー

```mermaid
graph TB
    Start([エラー発生]) --> CatchError[catch block でエラー捕捉]

    CatchError --> LogError[Logger.log:<br/>エラーメッセージとスタック]

    LogError --> CheckErrorType{エラータイプ判定}

    CheckErrorType -->|パラメータエラー| CreateParamError[エラーレスポンス:<br/>'必須パラメータが不足']
    CheckErrorType -->|フォルダー未検出| CreateFolderError[エラーレスポンス:<br/>'フォルダーが見つかりません']
    CheckErrorType -->|ファイル未検出| CreateFileError[エラーレスポンス:<br/>'ファイルが見つかりません']
    CheckErrorType -->|権限エラー| CreatePermError[エラーレスポンス:<br/>'アクセス権限がありません']
    CheckErrorType -->|その他| CreateGenericError[エラーレスポンス:<br/>error.message]

    CreateParamError --> WrapResponse[CommonWebhook:<br/>createErrorResponse]
    CreateFolderError --> WrapResponse
    CreateFileError --> WrapResponse
    CreatePermError --> WrapResponse
    CreateGenericError --> WrapResponse

    WrapResponse --> BuildJSON[JSON形式で構築:<br/>{status: 'error',<br/>timestamp,<br/>error: {...}}]

    BuildJSON --> SetMimeType[MimeType設定:<br/>application/json]

    SetMimeType --> ReturnResponse[HTTP 200で返却]

    ReturnResponse --> End([終了])

    style Start fill:#ffebee,stroke:#c62828,stroke-width:2px
    style End fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style CheckErrorType fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CreateParamError fill:#ffebee,stroke:#c62828,stroke-width:1px
    style CreateFolderError fill:#ffebee,stroke:#c62828,stroke-width:1px
    style CreateFileError fill:#ffebee,stroke:#c62828,stroke-width:1px
    style CreatePermError fill:#ffebee,stroke:#c62828,stroke-width:1px
    style CreateGenericError fill:#ffebee,stroke:#c62828,stroke-width:1px
```

## データフロー図

```mermaid
graph LR
    AppSheet[AppSheet<br/>または外部システム] -->|POST Request<br/>JSON| Webhook[GAS Webhook<br/>doPost]

    Webhook --> ParseModule[CommonWebhook<br/>parseRequest]
    ParseModule --> ValidateModule[main.gs<br/>validateRequiredParams]

    ValidateModule --> ProcessModule[main.gs<br/>processRequest]

    ProcessModule -->|baseFolderId,<br/>filePath| UtilityModule[FileIdUtilities<br/>getFileIdAndUrl]

    UtilityModule -->|フォルダーID| DriveAppAPI[DriveApp API]
    UtilityModule -->|フォルダーID<br/>supportsAllDrives| DriveAPIv3[Drive API v3]

    DriveAppAPI -->|フォルダー<br/>オブジェクト| UtilityModule
    DriveAPIv3 -->|フォルダー<br/>メタデータ| UtilityModule

    UtilityModule -->|ファイルID,<br/>URL| ProcessModule

    ProcessModule --> ResponseModule[CommonWebhook<br/>createSuccessResponse]

    ResponseModule -->|JSON Response| Webhook
    Webhook -->|HTTP 200<br/>JSON| AppSheet

    style AppSheet fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style Webhook fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style DriveAppAPI fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style DriveAPIv3 fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

## シーケンス図

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as doPost (main.gs)
    participant CW as CommonWebhook
    participant PR as processRequest
    participant FU as FileIdUtilities
    participant DA as DriveApp/API v3

    AS->>WH: POST Request (JSON)
    WH->>CW: handleDoPost(e, processFunction)
    CW->>CW: parseRequest(e)
    CW->>PR: processRequest(params)

    PR->>PR: validateRequiredParams(params)

    alt 単一ファイル
        PR->>FU: getFileIdAndUrl(baseFolderId, filePath)
    else 複数ファイル
        loop 各ファイルパス
            PR->>FU: getFileIdAndUrl(baseFolderId, path)
        end
    end

    FU->>FU: ファイルパス解析
    FU->>DA: getFolderById(baseFolderId)

    alt DriveApp成功
        DA-->>FU: Folder Object
    else DriveApp失敗（共有ドライブ）
        FU->>DA: Drive.Files.get(baseFolderId, {supportsAllDrives: true})
        DA-->>FU: Folder Metadata
        FU->>DA: getFolderById(baseFolderId) [再試行]
        DA-->>FU: Folder Object
    end

    loop フォルダー階層を探索
        FU->>DA: getFoldersByName(folderName)
        DA-->>FU: Folder Object
    end

    FU->>DA: getFilesByName(fileName)
    DA-->>FU: File Object

    FU->>FU: ファイルID/URL抽出
    FU-->>PR: {id, url}

    PR-->>CW: 処理結果 (success: true)
    CW->>CW: createSuccessResponse(result)
    CW-->>WH: TextOutput (JSON)
    WH-->>AS: HTTP 200 (JSON Response)
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Receiving: Webhook受信
    Receiving --> Parsing: リクエスト受信完了

    Parsing --> Validating: パース成功
    Parsing --> Error: パース失敗

    Validating --> Processing: 検証成功
    Validating --> Error: 検証失敗

    Processing --> SearchingFolder: フォルダー探索開始

    SearchingFolder --> SearchingFile: 目的フォルダー到達
    SearchingFolder --> Error: フォルダー未検出

    SearchingFile --> Success: ファイル検出
    SearchingFile --> Error: ファイル未検出

    Success --> Responding: レスポンス生成
    Error --> Responding: エラーレスポンス生成

    Responding --> [*]: HTTP返却

    note right of Processing
        単一ファイル: 1回処理
        複数ファイル: ループ処理
    end note

    note right of SearchingFolder
        DriveApp失敗時は
        Drive API v3で再試行
    end note
```

## パフォーマンス最適化フロー

```mermaid
graph TB
    Start([リクエスト受信]) --> CheckCache{キャッシュ戦略}

    CheckCache --> UseBaseFolder[baseFolderIdを<br/>なるべく近くに設定]
    UseBaseFolder --> MinimizePath[フォルダー階層を<br/>最小化]

    MinimizePath --> CheckMode{単一/複数?}

    CheckMode -->|単一| SingleExecution[1回のAPI呼び出し]
    CheckMode -->|複数| BatchExecution[バッチ処理:<br/>1リクエストで複数取得]

    SingleExecution --> APICall[Drive API呼び出し]
    BatchExecution --> LoopOptimize[同一フォルダー内の<br/>ファイルはキャッシュ効果]

    LoopOptimize --> APICall

    APICall --> Measure[実行時間計測]
    Measure --> CheckTime{実行時間<br/>6分以内?}

    CheckTime -->|Yes| Success[正常終了]
    CheckTime -->|No| Timeout[タイムアウト警告]

    Success --> End([終了])
    Timeout --> End

    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style End fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style Success fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Timeout fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CheckCache fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CheckMode fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style CheckTime fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様書
- [共通モジュール仕様](../../../common_modules/README.md)
