# 処理フロー図 - Appsheet_関係機関_情報取得

## 目次

- [全体フロー](#全体フロー)
- [詳細処理フロー](#詳細処理フロー)
- [Places API検索フロー](#places-api検索フロー)
- [営業時間整形フロー](#営業時間整形フロー)
- [AppSheet更新フロー](#appsheet更新フロー)
- [エラーハンドリングフロー](#エラーハンドリングフロー)
- [重複防止フロー](#重複防止フロー)
- [データフロー図](#データフロー図)
- [シーケンス図](#シーケンス図)

## 全体フロー

```mermaid
flowchart TB
    Start([Webhook受信]) --> Parse[パラメータ解析]
    Parse --> ValidateParams{必須パラメータ<br/>チェック}
    ValidateParams -->|不足| ErrorParam[エラー: パラメータ不足]
    ValidateParams -->|OK| DupCheck[重複チェック開始]

    DupCheck --> IsDup{重複?}
    IsDup -->|はい| ReturnDup[重複レスポンス返却]
    IsDup -->|いいえ| MarkProcessing[処理中マーク]

    MarkProcessing --> ProcessMain[メイン処理実行]
    ProcessMain --> GetPlace[Places API呼び出し]
    GetPlace --> PlaceSuccess{取得成功?}
    PlaceSuccess -->|エラー| ErrorPlace[エラー: Places API]
    PlaceSuccess -->|成功| UpdateAS[AppSheet更新]

    UpdateAS --> ASSuccess{更新成功?}
    ASSuccess -->|エラー| ErrorAS[エラー: AppSheet API]
    ASSuccess -->|成功| MarkComplete[処理完了マーク]

    MarkComplete --> LogSuccess[ログ記録: 成功]
    LogSuccess --> ReturnOK[OKレスポンス返却]

    ErrorParam --> LogError1[ログ記録: エラー]
    ErrorPlace --> LogError2[ログ記録: エラー]
    ErrorAS --> LogError3[ログ記録: エラー]
    LogError1 --> ReturnError[ERRORレスポンス返却]
    LogError2 --> ReturnError
    LogError3 --> ReturnError

    ReturnOK --> End([終了])
    ReturnDup --> End
    ReturnError --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style ProcessMain fill:#fff4e6
    style GetPlace fill:#e8f5e9
    style UpdateAS fill:#e8f5e9
    style ErrorParam fill:#ffebee
    style ErrorPlace fill:#ffebee
    style ErrorAS fill:#ffebee
    style DupCheck fill:#f3e5f5
    style MarkProcessing fill:#f3e5f5
    style MarkComplete fill:#f3e5f5
```

## 詳細処理フロー

```mermaid
flowchart TB
    Start([processRequest開始]) --> ExtractParams[パラメータ抽出]
    ExtractParams --> CheckParams{パラメータ<br/>存在確認}
    CheckParams -->|不足| ThrowError[例外スロー]
    CheckParams -->|OK| LogStart[処理開始ログ]

    LogStart --> CallPlaces[getPlaceDetails呼び出し]
    CallPlaces --> ExtractPostal[郵便番号抽出]
    ExtractPostal --> CleanAddr[住所クリーニング]
    CleanAddr --> BuildQuery[検索クエリ構築]

    BuildQuery --> PlacesAPI[Places API実行]
    PlacesAPI --> CheckResponse{レスポンス<br/>チェック}
    CheckResponse -->|200以外| ReturnError1[エラーオブジェクト返却]
    CheckResponse -->|200| ParseJSON[JSONパース]

    ParseJSON --> CheckPlaces{places配列<br/>存在?}
    CheckPlaces -->|なし| ReturnError2[エラー: 情報なし]
    CheckPlaces -->|あり| ExtractFirst[最初の結果を抽出]

    ExtractFirst --> FormatLatLong[緯度経度を文字列化]
    FormatLatLong --> FormatHours{営業時間<br/>存在?}
    FormatHours -->|なし| SkipHours[営業時間=null]
    FormatHours -->|あり| CallFormatHours[formatOpeningHours呼び出し]

    CallFormatHours --> BuildPlaceData[PlaceDataオブジェクト構築]
    SkipHours --> BuildPlaceData

    BuildPlaceData --> ReturnPlaceData[PlaceData返却]
    ReturnPlaceData --> CheckError{errorフィールド<br/>あり?}
    CheckError -->|あり| ThrowError2[例外スロー]
    CheckError -->|なし| CallUpdate[updateOrganization呼び出し]

    CallUpdate --> AddFields[org_id, info_accuracy追加]
    AddFields --> CleanNull[null値フィールド除外]
    CleanNull --> BuildPayload[AppSheet APIペイロード構築]
    BuildPayload --> CallAPI[AppSheet API実行]

    CallAPI --> CheckStatus{ステータス<br/>コード}
    CheckStatus -->|>=400| ThrowError3[例外スロー]
    CheckStatus -->|<400| LogComplete[処理完了ログ]
    LogComplete --> ReturnResult[結果オブジェクト返却]

    ReturnResult --> End([終了])
    ThrowError --> End
    ThrowError2 --> End
    ThrowError3 --> End
    ReturnError1 --> End
    ReturnError2 --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style PlacesAPI fill:#e8f5e9
    style CallAPI fill:#e8f5e9
    style ThrowError fill:#ffebee
    style ThrowError2 fill:#ffebee
    style ThrowError3 fill:#ffebee
    style ReturnError1 fill:#ffebee
    style ReturnError2 fill:#ffebee
```

## Places API検索フロー

```mermaid
flowchart TB
    Start([getPlaceDetails開始]) --> InputParams[入力: name, address]
    InputParams --> RegexMatch[正規表現マッチング]
    RegexMatch --> PostalMatch{郵便番号<br/>一致?}

    PostalMatch -->|なし| NoPostal[postalCode = null]
    PostalMatch -->|あり| ExtractPostal[postalCode抽出]
    ExtractPostal --> FormatPostal[xxx-xxxx形式に整形]
    FormatPostal --> RemovePostal[住所から郵便番号削除]

    NoPostal --> BuildQuery[検索クエリ構築]
    RemovePostal --> BuildQuery

    BuildQuery --> SetHeaders[APIヘッダー設定]
    SetHeaders --> SetFieldMask[FieldMask設定]
    SetFieldMask --> BuildRequest[リクエストボディ構築]

    BuildRequest --> LogQuery[検索クエリログ出力]
    LogQuery --> FetchAPI[UrlFetchApp.fetch実行]

    FetchAPI --> TryCatch{例外<br/>発生?}
    TryCatch -->|あり| LogError[エラーログ出力]
    TryCatch -->|なし| ParseResponse[レスポンス解析]

    LogError --> ReturnError[errorオブジェクト返却]
    ParseResponse --> CheckPlaces{places配列<br/>あり?}
    CheckPlaces -->|なし| ReturnNotFound[error: 情報なし]
    CheckPlaces -->|あり| SelectFirst[最初の要素選択]

    SelectFirst --> ExtractLocation{location<br/>フィールド?}
    ExtractLocation -->|なし| SetLocationNull[latlong = null]
    ExtractLocation -->|あり| FormatLatLong[緯度,経度に整形]

    SetLocationNull --> ExtractHours{regularOpeningHours<br/>フィールド?}
    FormatLatLong --> ExtractHours

    ExtractHours -->|なし| SetHoursNull[operating_hours = null]
    ExtractHours -->|あり| CallFormat[formatOpeningHours呼び出し]

    SetHoursNull --> BuildResult[結果オブジェクト構築]
    CallFormat --> BuildResult

    BuildResult --> LogSuccess[成功ログ出力]
    LogSuccess --> ReturnSuccess[PlaceDataオブジェクト返却]

    ReturnSuccess --> End([終了])
    ReturnError --> End
    ReturnNotFound --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style FetchAPI fill:#e8f5e9
    style LogError fill:#ffebee
    style ReturnError fill:#ffebee
    style ReturnNotFound fill:#ffebee
    style CallFormat fill:#fff4e6
```

## 営業時間整形フロー

```mermaid
flowchart TB
    Start([formatOpeningHours開始]) --> InputData[入力: openingHoursData]
    InputData --> InitWeekdays[曜日配列初期化]
    InitWeekdays --> InitDailyHours[dailyHoursオブジェクト初期化]
    InitDailyHours --> CheckPeriods{periodsフィールド<br/>存在?}

    CheckPeriods -->|なし| ReturnNull[null返却]
    CheckPeriods -->|あり| LoopStart{periods配列<br/>ループ開始}

    LoopStart --> NextPeriod[次のperiod取得]
    NextPeriod --> CheckOpenClose{open/close<br/>存在?}
    CheckOpenClose -->|なし| LoopStart
    CheckOpenClose -->|あり| GetDay[day値から曜日取得]

    GetDay --> FormatOpen[open時刻を整形]
    FormatOpen --> FormatClose[close時刻を整形]
    FormatClose --> BuildTimeRange[時間帯文字列構築]

    BuildTimeRange --> CheckDayExists{曜日エントリ<br/>存在?}
    CheckDayExists -->|なし| CreateArray[配列作成]
    CheckDayExists -->|あり| AppendArray[配列に追加]

    CreateArray --> LoopCheck{次のperiod<br/>あり?}
    AppendArray --> LoopCheck
    LoopCheck -->|あり| LoopStart
    LoopCheck -->|なし| MapWeekdays[曜日順にマップ]

    MapWeekdays --> NextDay{次の曜日}
    NextDay --> CheckEntry{dailyHours<br/>エントリあり?}
    CheckEntry -->|あり| FormatWithHours[曜日: 営業時間]
    CheckEntry -->|なし| FormatClosed[曜日: 定休日]

    FormatWithHours --> JoinNext{次の曜日<br/>あり?}
    FormatClosed --> JoinNext
    JoinNext -->|あり| NextDay
    JoinNext -->|なし| JoinLines[改行で結合]

    JoinLines --> ReturnResult[結果文字列返却]

    ReturnResult --> End([終了])
    ReturnNull --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style LoopStart fill:#fff4e6
    style MapWeekdays fill:#fff4e6
    style ReturnNull fill:#f5f5f5
```

## AppSheet更新フロー

```mermaid
flowchart TB
    Start([updateOrganization開始]) --> InputParams[入力: orgId, placeData]
    InputParams --> LogStart[更新開始ログ]
    LogStart --> AddOrgId[org_idフィールド追加]
    AddOrgId --> AddAccuracy[info_accuracy='確認済'追加]

    AddAccuracy --> InitClean[cleanedRowData初期化]
    InitClean --> LoopFields{フィールド<br/>ループ}

    LoopFields --> NextField[次のフィールド]
    NextField --> CheckNull{値がnull or<br/>undefined?}
    CheckNull -->|はい| SkipField[フィールドをスキップ]
    CheckNull -->|いいえ| AddField[cleanedRowDataに追加]

    AddField --> LoopCheck{次のフィールド<br/>あり?}
    SkipField --> LoopCheck
    LoopCheck -->|あり| LoopFields
    LoopCheck -->|なし| BuildPayload[ペイロード構築]

    BuildPayload --> SetAction[Action='Edit']
    SetAction --> SetProperties[Properties設定]
    SetProperties --> SetRows[Rows配列設定]
    SetRows --> LogPayload[ペイロードログ出力]

    LogPayload --> BuildURL[API URL構築]
    BuildURL --> SetOptions[fetchオプション設定]
    SetOptions --> SetHeaders[ヘッダー設定]
    SetHeaders --> TryCatch{例外<br/>処理}

    TryCatch --> FetchAPI[UrlFetchApp.fetch実行]
    FetchAPI --> GetResponse[レスポンス取得]
    GetResponse --> LogResponse[レスポンスログ出力]

    LogResponse --> CheckStatus{ステータス<br/>コード}
    CheckStatus -->|>=400| LogErrorAPI[APIエラーログ]
    CheckStatus -->|<400| LogSuccess[成功ログ出力]

    LogErrorAPI --> ThrowError[例外スロー]
    LogSuccess --> ReturnVoid[正常終了]

    TryCatch -->|例外| CatchError[例外キャッチ]
    CatchError --> LogError[エラーログ出力]
    LogError --> RethrowError[例外を再スロー]

    ReturnVoid --> End([終了])
    ThrowError --> End
    RethrowError --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style FetchAPI fill:#e8f5e9
    style LogErrorAPI fill:#ffebee
    style ThrowError fill:#ffebee
    style CatchError fill:#ffebee
    style RethrowError fill:#ffebee
```

## エラーハンドリングフロー

```mermaid
flowchart TB
    Start([エラー発生]) --> CatchError[try-catchでキャッチ]
    CatchError --> LogError[ロガーにエラー記録]
    LogError --> SetStatus[status='エラー']

    SetStatus --> CheckRecordId{recordId<br/>存在?}
    CheckRecordId -->|あり| MarkFailed[処理失敗マーク]
    CheckRecordId -->|なし| SkipMark[マークスキップ]

    MarkFailed --> SaveLog[ログをスプレッドシートに保存]
    SkipMark --> SaveLog

    SaveLog --> BuildErrorResponse[エラーレスポンス構築]
    BuildErrorResponse --> ReturnError[ERRORテキスト返却]

    ReturnError --> End([終了])

    style Start fill:#ffebee
    style End fill:#e1f5ff
    style CatchError fill:#ffebee
    style LogError fill:#ffebee
    style SetStatus fill:#ffebee
    style BuildErrorResponse fill:#ffebee
    style ReturnError fill:#ffebee
```

## 重複防止フロー

```mermaid
flowchart TB
    Start([executeWithRetry開始]) --> InitRetry[リトライカウンタ=1]
    InitRetry --> LogAttempt[試行ログ出力]
    LogAttempt --> CheckProcessed{既に処理済み?}

    CheckProcessed -->|はい| LogDuplicate[重複警告ログ]
    CheckProcessed -->|いいえ| MarkProcessing[処理中マーク試行]

    MarkProcessing --> LockSuccess{ロック取得<br/>成功?}
    LockSuccess -->|失敗| LogLockFail[ロック失敗ログ]
    LockSuccess -->|成功| ExecuteFunc[処理関数実行]

    ExecuteFunc --> TryCatch{例外<br/>発生?}
    TryCatch -->|なし| MarkComplete[処理完了マーク]
    TryCatch -->|あり| LogRetryError[リトライエラーログ]

    MarkComplete --> LogSuccess[成功ログ出力]
    LogSuccess --> ReturnSuccess[success=true返却]

    LogRetryError --> CheckRetryCount{リトライ回数<br/><最大値?}
    CheckRetryCount -->|はい| Sleep[待機時間]
    CheckRetryCount -->|いいえ| MarkError[エラーマーク]

    Sleep --> IncrementRetry[リトライカウンタ++]
    IncrementRetry --> LogAttempt

    MarkError --> ReturnFail[success=false返却]

    LogDuplicate --> ReturnDup[isDuplicate=true返却]
    LogLockFail --> ReturnDup

    ReturnSuccess --> End([終了])
    ReturnDup --> End
    ReturnFail --> End

    style Start fill:#e1f5ff
    style End fill:#e1f5ff
    style CheckProcessed fill:#f3e5f5
    style MarkProcessing fill:#f3e5f5
    style MarkComplete fill:#f3e5f5
    style ExecuteFunc fill:#fff4e6
    style LogDuplicate fill:#fff9c4
    style LogRetryError fill:#ffebee
    style MarkError fill:#ffebee
```

## データフロー図

```mermaid
flowchart LR
    AppSheet[AppSheet<br/>Webhook] -->|POST| GAS[Google Apps Script]

    subgraph GAS Process
        direction TB
        DoPost[doPost] --> DupCheck[重複チェック]
        DupCheck --> ProcessReq[processRequest]
        ProcessReq --> PlacesAPI[Places API<br/>Service]
        ProcessReq --> AppSheetAPI[AppSheet API<br/>Service]
    end

    PlacesAPI -->|GET| GooglePlaces[Google Places<br/>API]
    GooglePlaces -->|JSON| PlacesAPI

    AppSheetAPI -->|POST| AppSheetDB[AppSheet<br/>Database]
    AppSheetDB -->|Response| AppSheetAPI

    GAS -->|Log| Spreadsheet[実行ログ<br/>スプレッドシート]
    GAS -->|Response| AppSheet

    style AppSheet fill:#e3f2fd
    style GAS fill:#fff4e6
    style GooglePlaces fill:#e8f5e9
    style AppSheetDB fill:#f3e5f5
    style Spreadsheet fill:#fce4ec
```

## シーケンス図

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant GAS as GAS (doPost)
    participant DP as DuplicationPrevention
    participant Places as Places API
    participant ASApi as AppSheet API
    participant Log as Logger
    participant SS as Spreadsheet

    AS->>GAS: POST Webhook
    activate GAS
    GAS->>GAS: パラメータ解析
    GAS->>Log: createLogger
    activate Log

    GAS->>DP: executeWithRetry
    activate DP
    DP->>DP: isAlreadyProcessed?
    DP->>DP: markAsProcessing
    DP->>GAS: 処理実行許可

    GAS->>Places: getPlaceDetails
    activate Places
    Places->>Places: 郵便番号抽出
    Places->>Places: 検索クエリ構築
    Places-->>Places: API呼び出し
    Places->>GAS: PlaceData返却
    deactivate Places

    GAS->>ASApi: updateOrganization
    activate ASApi
    ASApi->>ASApi: データ整形
    ASApi-->>ASApi: API呼び出し
    ASApi->>GAS: 更新成功
    deactivate ASApi

    GAS->>DP: 処理完了
    DP->>DP: markAsCompleted
    deactivate DP

    GAS->>Log: success
    GAS->>Log: saveToSpreadsheet
    Log->>SS: ログ書き込み
    deactivate Log

    GAS->>AS: OK
    deactivate GAS
```

---

## 凡例

### フローチャート色分け

- **水色** (`#e1f5ff`): 開始/終了
- **黄色** (`#fff4e6`): メイン処理
- **緑色** (`#e8f5e9`): API呼び出し
- **赤色** (`#ffebee`): エラー
- **紫色** (`#f3e5f5`): 重複防止処理
- **グレー** (`#f5f5f5`): null/スキップ

### 記号

- **長方形**: 処理ステップ
- **菱形**: 条件分岐
- **角丸長方形**: 開始/終了
- **矢印**: データフロー
