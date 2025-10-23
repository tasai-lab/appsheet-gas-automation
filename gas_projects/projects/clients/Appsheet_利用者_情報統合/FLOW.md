# Appsheet_利用者_情報統合 - 処理フロー図

## 概要フロー

```mermaid
graph TB
    Start([外部システム/GASエディタ]) --> Mode{処理モード選択}

    Mode -->|利用者基本情報のみ| ClientOnly[updateClientInfo]
    Mode -->|家族情報のみ| FamilyOnly[updateFamilyInfo]
    Mode -->|統合更新| Both[updateClientAndFamily]

    ClientOnly --> GetClient[既存利用者情報取得]
    FamilyOnly --> GetFamily[既存家族情報取得]
    Both --> GetBoth[既存利用者+家族情報取得]

    GetClient --> ExtractClient[Vertex AI: 利用者情報抽出]
    GetFamily --> ExtractFamily[Vertex AI: 家族情報抽出]
    GetBoth --> ExtractBoth[Vertex AI: 統合抽出]

    ExtractClient --> UpdateClient[Clientsテーブル更新]
    ExtractFamily --> ProcessFamily[家族情報処理<br/>add/update判定]
    ExtractBoth --> UpdateBoth[利用者+家族更新]

    UpdateClient --> LogClient[実行ログ記録<br/>コスト情報含む]
    ProcessFamily --> LogFamily[実行ログ記録<br/>コスト情報含む]
    UpdateBoth --> LogBoth[実行ログ記録<br/>コスト情報含む]

    LogClient --> ResultClient[成功レスポンス]
    LogFamily --> ResultFamily[成功レスポンス]
    LogBoth --> ResultBoth[成功レスポンス]

    ResultClient --> End([処理完了])
    ResultFamily --> End
    ResultBoth --> End

    style Start fill:#e1f5ff
    style Mode fill:#fff4e1
    style ClientOnly fill:#e3f2fd
    style FamilyOnly fill:#e8f5e9
    style Both fill:#f3e5f5
    style End fill:#e1f5ff
    style ExtractClient fill:#fff9c4
    style ExtractFamily fill:#fff9c4
    style ExtractBoth fill:#fff9c4
```

## 詳細フロー1: 利用者基本情報のみ更新

```mermaid
graph TB
    Start([updateClientInfo呼び出し]) --> ValidateParams{パラメータ検証}
    ValidateParams -->|NG| ErrorParam[エラー: パラメータ不足]
    ValidateParams -->|OK| GetExisting[AppSheet Find API<br/>既存利用者情報取得]

    GetExisting --> ExtractInfo[Vertex AI API呼び出し<br/>extractClientInfoWithGemini]

    ExtractInfo --> ParseResponse{AI応答<br/>パース成功?}
    ParseResponse -->|失敗| ErrorParse[エラー: JSON抽出失敗]
    ParseResponse -->|成功| ExtractedData[抽出データ取得]

    ExtractedData --> RemoveFamily[family_membersフィールド削除]
    RemoveFamily --> ExcludeColumns[更新対象外カラム削除<br/>EXCLUDED_CLIENT_COLUMNS]

    ExcludeColumns --> CheckUpdate{更新データ<br/>存在?}
    CheckUpdate -->|なし| NoUpdate[更新スキップ]
    CheckUpdate -->|あり| UpdateAPI[AppSheet Edit API<br/>Clientsテーブル更新]

    UpdateAPI --> LogSuccess[実行ログ記録<br/>- ステータス: 成功<br/>- コスト情報<br/>- 処理時間]
    NoUpdate --> LogSuccess

    LogSuccess --> SuccessResponse[レスポンス:<br/>{status: 'success',<br/>clientUpdated: true/false,<br/>familyMembersAdded: 0,<br/>familyMembersUpdated: 0}]

    ErrorParam --> LogError[実行ログ記録<br/>ステータス: 失敗]
    ErrorParse --> LogError

    LogError --> ErrorResponse[レスポンス:<br/>{status: 'error',<br/>error: エラーメッセージ}]

    SuccessResponse --> End([処理完了])
    ErrorResponse --> End

    style Start fill:#e1f5ff
    style ValidateParams fill:#fff4e1
    style ExtractInfo fill:#fff9c4
    style UpdateAPI fill:#c8e6c9
    style End fill:#e1f5ff
    style ErrorParam fill:#ffcdd2
    style ErrorParse fill:#ffcdd2
```

## 詳細フロー2: 家族情報のみ更新

```mermaid
graph TB
    Start([updateFamilyInfo呼び出し]) --> ValidateParams{パラメータ検証}
    ValidateParams -->|NG| ErrorParam[エラー: パラメータ不足]
    ValidateParams -->|OK| GetExisting[AppSheet Find API<br/>既存家族情報取得]

    GetExisting --> ExtractInfo[Vertex AI API呼び出し<br/>extractFamilyInfoWithGemini]

    ExtractInfo --> ParseResponse{AI応答<br/>パース成功?}
    ParseResponse -->|失敗| ErrorParse[エラー: JSON抽出失敗]
    ParseResponse -->|成功| CheckMembers{家族情報<br/>存在?}

    CheckMembers -->|なし| LogNoData[ログ記録: 家族情報なし]
    CheckMembers -->|あり| ProcessLoop[各家族メンバー処理ループ]

    ProcessLoop --> CheckAction{actionフィールド<br/>の値は?}

    CheckAction -->|add| AddMember[新規家族追加<br/>- family_member_id生成<br/>- client_id設定<br/>- null値削除]
    CheckAction -->|update| UpdateMember[既存家族更新<br/>- family_member_id確認<br/>- null値削除<br/>- 空欄フィールドのみ補完]

    AddMember --> CollectAdd[追加リストに格納]
    UpdateMember --> CollectUpdate[更新リストに格納]

    CollectAdd --> MoreMembers{次の家族<br/>メンバー?}
    CollectUpdate --> MoreMembers

    MoreMembers -->|あり| ProcessLoop
    MoreMembers -->|なし| ExecuteAdd{追加リスト<br/>存在?}

    ExecuteAdd -->|あり| AddAPI[AppSheet Add API<br/>Client_Family_Membersテーブル]
    ExecuteAdd -->|なし| ExecuteUpdate

    AddAPI --> ExecuteUpdate{更新リスト<br/>存在?}
    ExecuteUpdate -->|あり| EditAPI[AppSheet Edit API<br/>Client_Family_Membersテーブル]
    ExecuteUpdate -->|なし| LogSuccess

    EditAPI --> LogSuccess[実行ログ記録<br/>- 追加件数<br/>- 更新件数<br/>- コスト情報]
    LogNoData --> LogSuccess

    LogSuccess --> SuccessResponse[レスポンス:<br/>{status: 'success',<br/>clientUpdated: false,<br/>familyMembersAdded: N,<br/>familyMembersUpdated: M}]

    ErrorParam --> LogError[実行ログ記録<br/>ステータス: 失敗]
    ErrorParse --> LogError

    LogError --> ErrorResponse[レスポンス:<br/>{status: 'error',<br/>error: エラーメッセージ}]

    SuccessResponse --> End([処理完了])
    ErrorResponse --> End

    style Start fill:#e1f5ff
    style ValidateParams fill:#fff4e1
    style ExtractInfo fill:#fff9c4
    style CheckAction fill:#fff4e1
    style AddAPI fill:#c8e6c9
    style EditAPI fill:#c8e6c9
    style End fill:#e1f5ff
    style ErrorParam fill:#ffcdd2
    style ErrorParse fill:#ffcdd2
```

## 詳細フロー3: 利用者＋家族統合更新

```mermaid
graph TB
    Start([updateClientAndFamily呼び出し]) --> ValidateParams{パラメータ検証}
    ValidateParams -->|NG| ErrorParam[エラー: パラメータ不足]
    ValidateParams -->|OK| GetClient[AppSheet Find API<br/>既存利用者情報取得]

    GetClient --> GetFamily[AppSheet Find API<br/>既存家族情報取得]

    GetFamily --> ExtractBoth[Vertex AI API呼び出し<br/>extractClientAndFamilyInfoWithGemini<br/>既存情報を統合プロンプトで提供]

    ExtractBoth --> ParseResponse{AI応答<br/>パース成功?}
    ParseResponse -->|失敗| ErrorParse[エラー: JSON抽出失敗]
    ParseResponse -->|成功| ExtractedData[統合データ取得]

    ExtractedData --> SeparateData[データ分離:<br/>- 利用者情報<br/>- 家族情報]

    SeparateData --> UpdateClient[Clientsテーブル更新<br/>updateClientData]
    UpdateClient --> CheckFamily{家族情報<br/>存在?}

    CheckFamily -->|あり| ProcessFamily[家族情報処理<br/>processFamilyMembersWithAction<br/>add/update分岐]
    CheckFamily -->|なし| SetFamilyZero[familyAdded=0<br/>familyUpdated=0]

    ProcessFamily --> LogSuccess[実行ログ記録<br/>- 利用者更新<br/>- 家族追加/更新件数<br/>- コスト情報<br/>- 処理時間]
    SetFamilyZero --> LogSuccess

    LogSuccess --> SuccessResponse[レスポンス:<br/>{status: 'success',<br/>clientUpdated: true/false,<br/>familyMembersAdded: N,<br/>familyMembersUpdated: M}]

    ErrorParam --> LogError[実行ログ記録<br/>ステータス: 失敗]
    ErrorParse --> LogError

    LogError --> ErrorResponse[レスポンス:<br/>{status: 'error',<br/>error: エラーメッセージ}]

    SuccessResponse --> End([処理完了])
    ErrorResponse --> End

    style Start fill:#e1f5ff
    style ValidateParams fill:#fff4e1
    style ExtractBoth fill:#fff9c4
    style UpdateClient fill:#c8e6c9
    style ProcessFamily fill:#c8e6c9
    style End fill:#e1f5ff
    style ErrorParam fill:#ffcdd2
    style ErrorParse fill:#ffcdd2
```

## Vertex AI統合フロー

```mermaid
graph TB
    Start([Vertex AI呼び出し]) --> BuildPrompt[プロンプト構築<br/>- OCRテキスト<br/>- 既存情報<br/>- 抽出ルール]

    BuildPrompt --> BuildRequest[リクエストボディ構築<br/>- contents<br/>- generationConfig<br/>  - responseMimeType: application/json<br/>  - temperature: 0.1<br/>  - maxOutputTokens: 8192]

    BuildRequest --> OAuth2[OAuth2認証<br/>ScriptApp.getOAuthToken]

    OAuth2 --> CallAPI[UrlFetchApp.fetch<br/>Vertex AI Endpoint<br/>{GCP_PROJECT_ID}/{MODEL}]

    CallAPI --> CheckStatus{HTTPステータス<br/>200?}
    CheckStatus -->|NG| ErrorAPI[エラー: API呼び出し失敗]
    CheckStatus -->|OK| ParseJSON[レスポンスJSON解析]

    ParseJSON --> ExtractUsage[usageMetadata抽出<br/>- promptTokenCount<br/>- candidatesTokenCount]

    ExtractUsage --> CalcCost[コスト計算<br/>- Input料金 = tokens × 単価 × 150円<br/>- Output料金 = tokens × 単価 × 150円<br/>- 合計料金]

    CalcCost --> CheckCandidates{candidates<br/>存在?}
    CheckCandidates -->|なし| ErrorNoCand[エラー: 有効な候補なし]
    CheckCandidates -->|あり| ExtractText[テキスト抽出<br/>candidates[0].content.parts[0].text]

    ExtractText --> ExtractJSON[JSON抽出<br/>- { から } までを切り出し<br/>- マーカー除去]

    ExtractJSON --> ParseData{JSONパース<br/>成功?}
    ParseData -->|失敗| ErrorJSON[エラー: JSON抽出失敗]
    ParseData -->|成功| ReturnResult[戻り値:<br/>{extractedData, usageMetadata}]

    ErrorAPI --> AttachUsage[usageMetadataをエラーに添付]
    ErrorNoCand --> AttachUsage
    ErrorJSON --> AttachUsage

    AttachUsage --> ThrowError[エラーをスロー]

    ReturnResult --> End([呼び出し元へ返却])
    ThrowError --> End

    style Start fill:#e1f5ff
    style BuildRequest fill:#fff9c4
    style CallAPI fill:#fff9c4
    style CalcCost fill:#e1bee7
    style ReturnResult fill:#c8e6c9
    style End fill:#e1f5ff
    style ErrorAPI fill:#ffcdd2
    style ErrorNoCand fill:#ffcdd2
    style ErrorJSON fill:#ffcdd2
```

## データフロー図

```mermaid
graph LR
    OCR[OCRテキスト] --> Func1[updateClientInfo]
    OCR --> Func2[updateFamilyInfo]
    OCR --> Func3[updateClientAndFamily]

    Func1 --> GetC[既存利用者情報]
    Func2 --> GetF[既存家族情報]
    Func3 --> GetCF[既存利用者+家族情報]

    GetC --> AI1[Vertex AI<br/>利用者情報抽出]
    GetF --> AI2[Vertex AI<br/>家族情報抽出]
    GetCF --> AI3[Vertex AI<br/>統合情報抽出]

    AI1 --> Extract1[抽出データ:<br/>- last_name<br/>- first_name<br/>- birth_date<br/>- phone1<br/>...]
    AI2 --> Extract2[抽出データ:<br/>family_members: [<br/>  {action, relationship, ...}<br/>]]
    AI3 --> Extract3[抽出データ:<br/>- 利用者情報<br/>- family_members]

    Extract1 --> Update1[AppSheet Edit<br/>Clientsテーブル]
    Extract2 --> Update2A[AppSheet Add<br/>Client_Family_Members<br/>action='add']
    Extract2 --> Update2B[AppSheet Edit<br/>Client_Family_Members<br/>action='update']
    Extract3 --> Update3A[AppSheet Edit<br/>Clientsテーブル]
    Extract3 --> Update3B[AppSheet Add/Edit<br/>Client_Family_Members]

    Update1 --> Log[実行ログ<br/>スプレッドシート<br/>16UHnMlSUlnUy...]
    Update2A --> Log
    Update2B --> Log
    Update3A --> Log
    Update3B --> Log

    AI1 --> Cost[コスト情報:<br/>- Input Tokens<br/>- Output Tokens<br/>- 料金JPY]
    AI2 --> Cost
    AI3 --> Cost

    Cost --> Log

    style OCR fill:#e1f5ff
    style AI1 fill:#fff9c4
    style AI2 fill:#fff9c4
    style AI3 fill:#fff9c4
    style Cost fill:#e1bee7
    style Log fill:#fff3e0
```

## エラーハンドリングフロー

```mermaid
graph TB
    Start([処理開始]) --> Try{Try処理}

    Try --> Process[メイン処理実行]

    Process --> Success{処理成功?}
    Success -->|成功| LogSuccess[実行ログ記録<br/>- ステータス: 成功<br/>- 更新件数<br/>- コスト情報<br/>- 処理時間]
    Success -->|失敗| Catch[Catchブロック]

    Catch --> CheckUsage{usageMetadata<br/>存在?}
    CheckUsage -->|あり| ExtractUsage[エラーからusageMetadata抽出<br/>error.usageMetadata]
    CheckUsage -->|なし| SetNull[usageMetadata = null]

    ExtractUsage --> LogError[実行ログ記録<br/>- ステータス: 失敗<br/>- エラーメッセージ<br/>- コスト情報可能な限り]
    SetNull --> LogError

    LogSuccess --> ReturnSuccess[成功レスポンス返却<br/>{status: 'success', ...}]
    LogError --> ReturnError[エラーレスポンス返却<br/>{status: 'error', ...}]

    ReturnSuccess --> End([処理終了])
    ReturnError --> End

    style Start fill:#e1f5ff
    style Try fill:#fff4e1
    style Success fill:#fff4e1
    style Catch fill:#ffcdd2
    style LogSuccess fill:#c8e6c9
    style LogError fill:#ffcdd2
    style End fill:#e1f5ff
```

## 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> パラメータ検証

    パラメータ検証 --> 既存データ取得: パラメータOK
    パラメータ検証 --> エラー状態: パラメータNG

    既存データ取得 --> AI情報抽出: 既存データ取得成功
    既存データ取得 --> エラー状態: AppSheet APIエラー

    AI情報抽出 --> データ更新: 情報抽出成功
    AI情報抽出 --> エラー状態: Vertex AIエラー
    AI情報抽出 --> エラー状態: JSONパースエラー

    データ更新 --> ログ記録成功: 更新成功
    データ更新 --> エラー状態: AppSheet APIエラー

    ログ記録成功 --> 成功レスポンス: ログ記録完了

    エラー状態 --> ログ記録失敗: エラー詳細記録
    ログ記録失敗 --> エラーレスポンス: ログ記録完了

    成功レスポンス --> [*]
    エラーレスポンス --> [*]

    note right of AI情報抽出
        Vertex AI呼び出し
        - Gemini 2.5 Flash使用
        - OAuth2認証
        - コスト追跡
    end note

    note right of データ更新
        AppSheet API呼び出し
        - Edit/Add アクション
        - 重複チェック（家族情報）
        - null値除去
    end note
```

## シーケンス図: 統合更新処理

```mermaid
sequenceDiagram
    participant Caller as 外部システム/GASエディタ
    participant Main as updateClientAndFamily
    participant AppSheet as AppSheet API
    participant VertexAI as Vertex AI
    participant Logger as 実行ログ

    Caller->>Main: updateClientAndFamily(clientId, ocrText)

    Main->>Main: パラメータ検証

    Main->>AppSheet: Find(Clients, clientId)
    AppSheet-->>Main: 既存利用者情報

    Main->>AppSheet: Find(Client_Family_Members, clientId)
    AppSheet-->>Main: 既存家族情報

    Main->>VertexAI: extractClientAndFamilyInfoWithGemini<br/>(ocrText, existingClientInfo, existingFamilyMembers)

    VertexAI->>VertexAI: プロンプト構築<br/>+ 既存データ提供
    VertexAI->>VertexAI: OAuth2認証
    VertexAI->>VertexAI: API呼び出し
    VertexAI->>VertexAI: usageMetadata抽出
    VertexAI->>VertexAI: コスト計算
    VertexAI-->>Main: {extractedData, usageMetadata}

    Main->>Main: データ分離<br/>- 利用者情報<br/>- 家族情報

    Main->>Main: 更新対象外カラム除去
    Main->>Main: null値除去

    Main->>AppSheet: Edit(Clients, clientInfo)
    AppSheet-->>Main: 更新成功

    loop 各家族メンバー
        Main->>Main: action='add' or 'update'?
        alt action='add'
            Main->>AppSheet: Add(Client_Family_Members, member)
            AppSheet-->>Main: 追加成功
        else action='update'
            Main->>AppSheet: Edit(Client_Family_Members, member)
            AppSheet-->>Main: 更新成功
        end
    end

    Main->>Logger: logSuccess<br/>(clientId, 処理種別, 更新件数, コスト情報, 処理時間)
    Logger-->>Main: ログ記録完了

    Main-->>Caller: {status: 'success', clientUpdated: true, familyMembersAdded: N, familyMembersUpdated: M}
```

## コスト追跡フロー

```mermaid
graph TB
    Start([Vertex AI API呼び出し]) --> Response[APIレスポンス受信]

    Response --> ExtractMeta[usageMetadata抽出<br/>jsonResponse.usageMetadata]

    ExtractMeta --> CheckMeta{usageMetadata<br/>存在?}
    CheckMeta -->|なし| ReturnNull[null返却]
    CheckMeta -->|あり| ExtractTokens[トークン数抽出<br/>- promptTokenCount<br/>- candidatesTokenCount]

    ExtractTokens --> GetPricing[価格表取得<br/>pricingTable[modelName]]

    GetPricing --> CalcInputUSD[Input料金USD計算<br/>tokens / 1000000 × inputPer1M]
    CalcInputUSD --> CalcOutputUSD[Output料金USD計算<br/>tokens / 1000000 × outputPer1M]

    CalcOutputUSD --> CalcTotalUSD[合計料金USD<br/>inputUSD + outputUSD]

    CalcTotalUSD --> ConvertJPY[円換算<br/>USD × 150円]

    ConvertJPY --> BuildMetadata[usageMetadataオブジェクト構築<br/>{model, inputTokens, outputTokens,<br/>inputCostJPY, outputCostJPY, totalCostJPY}]

    BuildMetadata --> ReturnMetadata[usageMetadata返却]

    ReturnNull --> End([終了])
    ReturnMetadata --> End

    style Start fill:#e1f5ff
    style ExtractTokens fill:#fff9c4
    style GetPricing fill:#e1bee7
    style ConvertJPY fill:#e1bee7
    style BuildMetadata fill:#c8e6c9
    style End fill:#e1f5ff
```

## 家族情報のaction判定フロー

```mermaid
graph TB
    Start([家族情報抽出]) --> ProvideExisting[既存家族情報を<br/>Geminiに提供]

    ProvideExisting --> AIJudge[Gemini自動判断<br/>- 名前照合表記揺れ対応<br/>- 新規/更新判定]

    AIJudge --> Loop[各家族メンバー処理]

    Loop --> CheckAction{actionフィールド}

    CheckAction -->|add| NewMember[新規家族<br/>- family_member_id生成<br/>- client_id設定<br/>- 全フィールド設定]

    CheckAction -->|update| ExistingMember[既存家族<br/>- family_member_id維持<br/>- 空欄フィールドのみ補完<br/>- 既存値は保持]

    NewMember --> AddList[追加リストに格納]
    ExistingMember --> UpdateList[更新リストに格納]

    AddList --> MoreMembers{次の家族?}
    UpdateList --> MoreMembers

    MoreMembers -->|あり| Loop
    MoreMembers -->|なし| ExecuteBatch[バッチ実行<br/>- Add API: 追加リスト<br/>- Edit API: 更新リスト]

    ExecuteBatch --> End([処理完了])

    style Start fill:#e1f5ff
    style AIJudge fill:#fff9c4
    style CheckAction fill:#fff4e1
    style NewMember fill:#c8e6c9
    style ExistingMember fill:#bbdefb
    style ExecuteBatch fill:#c8e6c9
    style End fill:#e1f5ff
```

## 利用者情報の更新判定フロー

```mermaid
graph TB
    Start([利用者情報抽出]) --> ProvideExisting[既存利用者情報を<br/>Geminiに提供]

    ProvideExisting --> AICompare[Gemini比較判断<br/>- OCRテキスト vs 既存情報<br/>- 変更箇所のみ抽出<br/>- 同一内容はnull]

    AICompare --> ExtractedData[抽出データ取得]

    ExtractedData --> RemoveNull[null値を削除<br/>変更箇所のみ残る]

    RemoveNull --> ExcludeColumns[更新対象外カラム削除<br/>EXCLUDED_CLIENT_COLUMNS]

    ExcludeColumns --> CheckData{更新データ<br/>存在?}

    CheckData -->|なし| NoUpdate[更新スキップ<br/>既存情報と同一]
    CheckData -->|あり| BuildPayload[Editペイロード構築<br/>- client_id<br/>- 変更フィールドのみ]

    BuildPayload --> CallAPI[AppSheet Edit API<br/>Clientsテーブル]

    CallAPI --> UpdateSuccess[更新成功]
    NoUpdate --> SkipSuccess[スキップ成功]

    UpdateSuccess --> End([処理完了])
    SkipSuccess --> End

    style Start fill:#e1f5ff
    style AICompare fill:#fff9c4
    style RemoveNull fill:#fff4e1
    style CheckData fill:#fff4e1
    style CallAPI fill:#c8e6c9
    style NoUpdate fill:#e0e0e0
    style End fill:#e1f5ff
```

## 処理時間とコストの記録フロー

```mermaid
graph TB
    Start([処理開始]) --> StartTimer[ExecutionTimer開始]

    StartTimer --> MainProcess[メイン処理実行]

    MainProcess --> GetUsage{usageMetadata<br/>取得?}
    GetUsage -->|あり| ExtractCost[コスト情報抽出<br/>- Input Tokens<br/>- Output Tokens<br/>- Input料金JPY<br/>- Output料金JPY<br/>- 合計料金JPY]
    GetUsage -->|なし| SetEmpty[空値設定]

    ExtractCost --> GetTime[処理時間計算<br/>timer.getElapsedSeconds]
    SetEmpty --> GetTime

    GetTime --> BuildLog[ログデータ構築<br/>- タイムスタンプ<br/>- スクリプト名<br/>- ステータス<br/>- 利用者ID<br/>- 利用者名<br/>- 処理種別<br/>- 更新件数<br/>- 処理時間秒<br/>- モデル名<br/>- 実行ユーザー<br/>- Input Tokens<br/>- Output Tokens<br/>- Input料金円<br/>- Output料金円<br/>- 合計料金円]

    BuildLog --> WriteLog[スプレッドシート書き込み<br/>16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA<br/>実行履歴_利用者情報統合シート]

    WriteLog --> End([処理終了])

    style Start fill:#e1f5ff
    style ExtractCost fill:#e1bee7
    style GetTime fill:#e1bee7
    style WriteLog fill:#fff3e0
    style End fill:#e1f5ff
```
