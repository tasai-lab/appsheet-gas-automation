# Appsheet_通話_イベント・タスク作成 - 処理フロー図

## 概要フロー

```mermaid
graph TB
    Start([AppSheet Webhook]) --> DoPost[doPost<br/>Webhookエントリーポイント]

    DoPost --> Parse[JSONペイロードパース<br/>- actionId<br/>- actionType<br/>- title<br/>- details<br/>- startDateTime/endDateTime<br/>- dueDateTime<br/>- assigneeEmail<br/>- rowUrl]

    Parse --> CallProcess[processRequest呼び出し]

    CallProcess --> Validate{パラメータ検証}
    Validate -->|NG| ErrorParam[エラー: パラメータ不足]
    Validate -->|OK| Normalize[actionType正規化<br/>toLowerCase + trim]

    Normalize --> CheckType{actionType値}

    CheckType -->|'event'/'イベント'| ValidateEvent{イベント用<br/>パラメータ?}
    CheckType -->|'task'/'タスク'| ValidateTask{タスク用<br/>パラメータ?}
    CheckType -->|その他| ErrorType[エラー: 未対応のアクションタイプ]

    ValidateEvent -->|startDateTime/endDateTime なし| ErrorEvent[エラー: 日時パラメータ不足]
    ValidateEvent -->|OK| CreateEvent[createGoogleCalendarEvent]

    ValidateTask -->|dueDateTime なし| ErrorTask[エラー: 期限パラメータ不足]
    ValidateTask -->|OK| CreateTask[createGoogleTask]

    CreateEvent --> OAuth2_1[OAuth2認証<br/>createOAuth2ServiceForUser<br/>Calendar Scope]
    CreateTask --> OAuth2_2[OAuth2認証<br/>createOAuth2ServiceForUser<br/>Tasks Scope]

    OAuth2_1 --> API_Event[Calendar API<br/>events.insert]
    OAuth2_2 --> API_Task[Tasks API<br/>tasks.insert]

    API_Event --> CheckResult1{処理結果}
    API_Task --> CheckResult2{処理結果}

    CheckResult1 -->|SUCCESS| UpdateSuccess1[AppSheet更新<br/>updateActionOnSuccess<br/>status: 反映済み]
    CheckResult1 -->|FAILURE| UpdateError1[AppSheet更新<br/>updateActionOnError<br/>status: エラー]

    CheckResult2 -->|SUCCESS| UpdateSuccess2[AppSheet更新<br/>updateActionOnSuccess<br/>status: 反映済み]
    CheckResult2 -->|FAILURE| UpdateError2[AppSheet更新<br/>updateActionOnError<br/>status: エラー]

    UpdateSuccess1 --> Response1[成功レスポンス]
    UpdateSuccess2 --> Response2[成功レスポンス]
    UpdateError1 --> Response3[エラーレスポンス]
    UpdateError2 --> Response4[エラーレスポンス]

    ErrorParam --> Response5[エラーレスポンス]
    ErrorType --> Response5
    ErrorEvent --> Response5
    ErrorTask --> Response5

    Response1 --> End([処理完了])
    Response2 --> End
    Response3 --> End
    Response4 --> End
    Response5 --> End

    style Start fill:#e1f5ff
    style CheckType fill:#fff4e1
    style OAuth2_1 fill:#fff9c4
    style OAuth2_2 fill:#fff9c4
    style API_Event fill:#c8e6c9
    style API_Task fill:#bbdefb
    style End fill:#e1f5ff
    style ErrorParam fill:#ffcdd2
    style ErrorType fill:#ffcdd2
    style ErrorEvent fill:#ffcdd2
    style ErrorTask fill:#ffcdd2
```

## 詳細フロー1: イベント作成処理

```mermaid
graph TB
    Start([createGoogleCalendarEvent呼び出し]) --> ExtractParams[パラメータ抽出<br/>- title<br/>- details<br/>- startDateTime<br/>- endDateTime<br/>- assigneeEmail<br/>- rowUrl]

    ExtractParams --> TryCatch{Try-Catch}

    TryCatch --> SetScope[スコープ設定<br/>https://www.googleapis.com/auth/calendar]

    SetScope --> CreateService[createOAuth2ServiceForUser<br/>servicePrefix: CalendarImpersonation]

    CreateService --> GetToken[getAccessToken<br/>OAuth2トークン取得]

    GetToken --> CheckToken{トークン<br/>取得成功?}
    CheckToken -->|失敗| CatchError[Catchブロック]
    CheckToken -->|成功| CleanURL[rowURL整形<br/>HTMLタグ除去]

    CleanURL --> BuildDesc[description構築<br/>details + AppSheet URL]

    BuildDesc --> ParseDates[日時パース<br/>new Date(startDateTime)<br/>new Date(endDateTime)]

    ParseDates --> BuildResource[イベントリソース構築<br/>- summary: title<br/>- description<br/>- start: {dateTime, timeZone}<br/>- end: {dateTime, timeZone}]

    BuildResource --> SetAPIURL[Calendar APIエンドポイント<br/>/calendar/v3/calendars/primary/events]

    SetAPIURL --> CallAPI[UrlFetchApp.fetch<br/>POST リクエスト<br/>Authorization: Bearer {token}]

    CallAPI --> CheckStatus{HTTPステータス<br/>200?}

    CheckStatus -->|NG| CatchError
    CheckStatus -->|OK| ParseResponse[レスポンスJSON解析<br/>- id<br/>- htmlLink]

    ParseResponse --> SetResult[result設定<br/>- status: SUCCESS<br/>- externalId: id<br/>- externalUrl: htmlLink]

    SetResult --> Log1[ログ記録: イベント作成成功]

    Log1 --> ReturnSuccess[結果返却<br/>{status: SUCCESS, ...}]

    CatchError --> SetError[result設定<br/>- status: FAILURE<br/>- errorMessage: e.message]

    SetError --> Log2[ログ記録: イベント作成エラー]

    Log2 --> ReturnError[結果返却<br/>{status: FAILURE, ...}]

    ReturnSuccess --> End([処理完了])
    ReturnError --> End

    style Start fill:#e1f5ff
    style TryCatch fill:#fff4e1
    style CreateService fill:#fff9c4
    style CallAPI fill:#c8e6c9
    style End fill:#e1f5ff
    style CatchError fill:#ffcdd2
```

## 詳細フロー2: タスク作成処理

```mermaid
graph TB
    Start([createGoogleTask呼び出し]) --> ExtractParams[パラメータ抽出<br/>- title<br/>- details<br/>- dueDateTime<br/>- assigneeEmail]

    ExtractParams --> TryCatch{Try-Catch}

    TryCatch --> SetScope[スコープ設定<br/>https://www.googleapis.com/auth/tasks]

    SetScope --> CreateService[createOAuth2ServiceForUser<br/>servicePrefix: TasksImpersonation]

    CreateService --> GetToken[getAccessToken<br/>OAuth2トークン取得]

    GetToken --> CheckToken{トークン<br/>取得成功?}
    CheckToken -->|失敗| CatchError[Catchブロック]
    CheckToken -->|成功| ParseDate[日時パース<br/>new Date(dueDateTime)<br/>toISOString]

    ParseDate --> BuildResource[タスクリソース構築<br/>- title<br/>- notes: details<br/>- due: RFC3339形式]

    BuildResource --> SetAPIURL[Tasks APIエンドポイント<br/>/tasks/v1/lists/@default/tasks]

    SetAPIURL --> CallAPI[UrlFetchApp.fetch<br/>POST リクエスト<br/>Authorization: Bearer {token}]

    CallAPI --> CheckStatus{HTTPステータス<br/>200?}

    CheckStatus -->|NG| CatchError
    CheckStatus -->|OK| ParseResponse[レスポンスJSON解析<br/>- id<br/>- selfLink]

    ParseResponse --> SetResult[result設定<br/>- status: SUCCESS<br/>- externalId: id<br/>- externalUrl: selfLink]

    SetResult --> Log1[ログ記録: タスク作成成功]

    Log1 --> ReturnSuccess[結果返却<br/>{status: SUCCESS, ...}]

    CatchError --> SetError[result設定<br/>- status: FAILURE<br/>- errorMessage: e.message]

    SetError --> Log2[ログ記録: タスク作成エラー]

    Log2 --> ReturnError[結果返却<br/>{status: FAILURE, ...}]

    ReturnSuccess --> End([処理完了])
    ReturnError --> End

    style Start fill:#e1f5ff
    style TryCatch fill:#fff4e1
    style CreateService fill:#fff9c4
    style CallAPI fill:#bbdefb
    style End fill:#e1f5ff
    style CatchError fill:#ffcdd2
```

## OAuth2認証フロー

```mermaid
graph TB
    Start([createOAuth2ServiceForUser]) --> GetProperty[ScriptProperties取得<br/>SERVICE_ACCOUNT_JSON]

    GetProperty --> CheckProperty{プロパティ<br/>存在?}
    CheckProperty -->|なし| ErrorProperty[エラー: プロパティ未設定]
    CheckProperty -->|あり| ParseJSON[JSONパース<br/>serviceAccountInfo]

    ParseJSON --> CreateService[OAuth2.createService作成<br/>{servicePrefix}:{userEmail}]

    CreateService --> SetTokenURL[setTokenUrl<br/>https://oauth2.googleapis.com/token]
    SetTokenURL --> SetPrivateKey[setPrivateKey<br/>serviceAccountInfo.private_key]
    SetPrivateKey --> SetIssuer[setIssuer<br/>serviceAccountInfo.client_email]
    SetIssuer --> SetClientId[setClientId<br/>serviceAccountInfo.client_id]
    SetClientId --> SetSubject[setSubject<br/>userEmail なりすまし]

    SetSubject --> SetScope[setScope<br/>scopes.join(' ')]
    SetScope --> SetPropertyStore[setPropertyStore]
    SetPropertyStore --> SetCache[setCache]
    SetCache --> SetLock[setLock]

    SetLock --> ReturnService[OAuth2サービス返却]

    ReturnService --> GetAccess[getAccessToken呼び出し]

    GetAccess --> HasAccess{hasAccess?}
    HasAccess -->|なし| LogRefresh[ログ: トークンリフレッシュ]
    HasAccess -->|あり| GetToken

    LogRefresh --> GetToken[service.getAccessToken]

    GetToken --> CheckToken{トークン<br/>存在?}
    CheckToken -->|なし| ErrorToken[エラー: トークン取得失敗]
    CheckToken -->|あり| ReturnToken[トークン返却]

    ErrorProperty --> End([処理終了])
    ErrorToken --> End
    ReturnToken --> End

    style Start fill:#e1f5ff
    style CheckProperty fill:#fff4e1
    style SetSubject fill:#fff9c4
    style GetToken fill:#c8e6c9
    style End fill:#e1f5ff
    style ErrorProperty fill:#ffcdd2
    style ErrorToken fill:#ffcdd2
```

## AppSheet更新フロー

```mermaid
graph TB
    Start([処理完了]) --> CheckResult{処理結果}

    CheckResult -->|成功| UpdateSuccess[updateActionOnSuccess呼び出し]
    CheckResult -->|失敗| UpdateError[updateActionOnError呼び出し]

    UpdateSuccess --> BuildPayloadSuccess[Editペイロード構築<br/>- action_id<br/>- external_id<br/>- external_url<br/>- status: 反映済み]

    UpdateError --> BuildPayloadError[Editペイロード構築<br/>- action_id<br/>- status: エラー<br/>- error_details]

    BuildPayloadSuccess --> CallAPI1[callAppSheetApi]
    BuildPayloadError --> CallAPI2[callAppSheetApi]

    CallAPI1 --> SetURL1[AppSheet APIエンドポイント<br/>/api/v2/apps/{appId}/tables/Call_Actions/Action]
    CallAPI2 --> SetURL2[AppSheet APIエンドポイント<br/>/api/v2/apps/{appId}/tables/Call_Actions/Action]

    SetURL1 --> Fetch1[UrlFetchApp.fetch<br/>POST リクエスト<br/>ApplicationAccessKey: {key}]
    SetURL2 --> Fetch2[UrlFetchApp.fetch<br/>POST リクエスト<br/>ApplicationAccessKey: {key}]

    Fetch1 --> CheckStatus1{HTTPステータス<br/>400未満?}
    Fetch2 --> CheckStatus2{HTTPステータス<br/>400未満?}

    CheckStatus1 -->|OK| Log1[ログ記録: AppSheet更新成功]
    CheckStatus1 -->|NG| Error1[エラー: AppSheet APIエラー]

    CheckStatus2 -->|OK| Log2[ログ記録: AppSheet更新成功]
    CheckStatus2 -->|NG| Error2[エラー: AppSheet APIエラー]

    Log1 --> End([処理完了])
    Log2 --> End
    Error1 --> End
    Error2 --> End

    style Start fill:#e1f5ff
    style CheckResult fill:#fff4e1
    style Fetch1 fill:#c8e6c9
    style Fetch2 fill:#ffab91
    style End fill:#e1f5ff
    style Error1 fill:#ffcdd2
    style Error2 fill:#ffcdd2
```

## データフロー図

```mermaid
graph LR
    Input[AppSheet Webhook<br/>Call_Actions] --> Params[パラメータ<br/>- actionId<br/>- actionType<br/>- title<br/>- details<br/>- startDateTime<br/>- endDateTime<br/>- dueDateTime<br/>- assigneeEmail]

    Params --> Process[processRequest]

    Process --> Branch{actionType<br/>分岐}

    Branch -->|event| Event[createGoogleCalendarEvent]
    Branch -->|task| Task[createGoogleTask]

    Event --> OAuth1[OAuth2認証<br/>Calendar Scope]
    Task --> OAuth2[OAuth2認証<br/>Tasks Scope]

    OAuth1 --> ScriptProps1[ScriptProperties<br/>SERVICE_ACCOUNT_JSON]
    OAuth2 --> ScriptProps2[ScriptProperties<br/>SERVICE_ACCOUNT_JSON]

    ScriptProps1 --> Token1[アクセストークン]
    ScriptProps2 --> Token2[アクセストークン]

    Token1 --> CalendarAPI[Calendar API<br/>events.insert]
    Token2 --> TasksAPI[Tasks API<br/>tasks.insert]

    CalendarAPI --> Response1[レスポンス<br/>- id<br/>- htmlLink]
    TasksAPI --> Response2[レスポンス<br/>- id<br/>- selfLink]

    Response1 --> Result[結果<br/>{status, externalId, externalUrl}]
    Response2 --> Result

    Result --> AppSheet[AppSheet API<br/>Call_Actions更新]

    AppSheet --> DB[AppSheetデータベース<br/>Call_Actions]

    style Input fill:#e1f5ff
    style Branch fill:#fff4e1
    style OAuth1 fill:#fff9c4
    style OAuth2 fill:#fff9c4
    style CalendarAPI fill:#c8e6c9
    style TasksAPI fill:#bbdefb
    style DB fill:#fff3e0
```

## エラーハンドリングフロー

```mermaid
graph TB
    Start([処理開始]) --> Try{Try処理}

    Try --> MainProcess[メイン処理実行]

    MainProcess --> Success{処理成功?}
    Success -->|成功| UpdateSuccess[AppSheet更新: 反映済み]
    Success -->|失敗| Catch[Catchブロック]

    Catch --> ErrorType{エラータイプ}

    ErrorType -->|パラメータエラー| Log1[ログ記録: パラメータエラー]
    ErrorType -->|OAuth2エラー| Log2[ログ記録: OAuth2エラー]
    ErrorType -->|API エラー| Log3[ログ記録: APIエラー]
    ErrorType -->|その他| Log4[ログ記録: その他エラー]

    Log1 --> UpdateError[AppSheet更新: エラー]
    Log2 --> UpdateError
    Log3 --> UpdateError
    Log4 --> UpdateError

    UpdateSuccess --> ReturnSuccess[成功レスポンス返却]
    UpdateError --> ReturnError[エラーレスポンス返却]

    ReturnSuccess --> End([処理終了])
    ReturnError --> End

    style Start fill:#e1f5ff
    style Try fill:#fff4e1
    style Success fill:#fff4e1
    style Catch fill:#ffcdd2
    style UpdateSuccess fill:#c8e6c9
    style UpdateError fill:#ffab91
    style End fill:#e1f5ff
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Webhook受信

    Webhook受信 --> パラメータ検証: JSON解析
    パラメータ検証 --> アクションタイプ判定: パラメータOK
    パラメータ検証 --> エラー状態: パラメータNG

    アクションタイプ判定 --> イベント作成処理: event/イベント
    アクションタイプ判定 --> タスク作成処理: task/タスク
    アクションタイプ判定 --> エラー状態: 未対応タイプ

    イベント作成処理 --> OAuth2認証: パラメータOK
    タスク作成処理 --> OAuth2認証: パラメータOK

    OAuth2認証 --> Google API呼び出し: 認証成功
    OAuth2認証 --> エラー状態: 認証失敗

    Google API呼び出し --> AppSheet更新成功: API成功
    Google API呼び出し --> エラー状態: APIエラー

    AppSheet更新成功 --> 成功レスポンス: 更新完了

    エラー状態 --> AppSheet更新エラー: エラー詳細記録
    AppSheet更新エラー --> エラーレスポンス: 更新完了

    成功レスポンス --> [*]
    エラーレスポンス --> [*]

    note right of OAuth2認証
        サービスアカウント使用
        なりすまし認証
        Calendar/Tasks スコープ
    end note

    note right of Google API呼び出し
        Calendar: events.insert
        Tasks: tasks.insert
        日本時間(JST)対応
    end note
```

## シーケンス図: イベント作成処理

```mermaid
sequenceDiagram
    participant AppSheet as AppSheet Webhook
    participant Webhook as webhook.gs
    participant Processor as action_processor.gs
    participant Google as google_service.gs
    participant OAuth as oauth_service.gs
    participant API as Calendar API
    participant Update as appsheet_api.gs

    AppSheet->>Webhook: doPost(e)<br/>JSON Webhook

    Webhook->>Webhook: JSON解析

    Webhook->>Processor: processRequest<br/>(actionId, actionType='event', ...)

    Processor->>Processor: パラメータ検証

    Processor->>Processor: actionType正規化

    Processor->>Google: createGoogleCalendarEvent<br/>({title, details, startDateTime, ...})

    Google->>OAuth: createOAuth2ServiceForUser<br/>(assigneeEmail, calendarScope)

    OAuth->>OAuth: サービスアカウント取得<br/>ScriptProperties

    OAuth->>OAuth: OAuth2.createService<br/>なりすまし設定

    OAuth-->>Google: OAuth2サービス

    Google->>OAuth: getAccessToken(service)

    OAuth-->>Google: アクセストークン

    Google->>Google: イベントリソース構築<br/>- summary<br/>- description<br/>- start/end

    Google->>API: POST /calendar/v3/calendars/primary/events<br/>Authorization: Bearer {token}

    API-->>Google: {id, htmlLink, ...}

    Google-->>Processor: {status: SUCCESS,<br/>externalId, externalUrl}

    Processor->>Update: updateActionOnSuccess<br/>(actionId, externalId, externalUrl)

    Update->>AppSheet: PUT Call_Actions<br/>{status: 反映済み, external_id, external_url}

    AppSheet-->>Update: 更新完了

    Update-->>Processor: 更新成功

    Processor-->>Webhook: {success: true, ...}

    Webhook-->>AppSheet: JSON Response
```
