# Appsheet_訪問看護_報告書 - 処理フロー図

本ドキュメントでは、医療機関向け報告書生成システムの処理フローを図解します。

## 1. メイン処理フロー

```mermaid
graph TB
    Start([AppSheet Webhook]):::webhook --> Parse[リクエストパース]:::process
    Parse --> Validate{パラメータ<br/>検証}:::decision

    Validate -->|不足| Error1[エラーレスポンス]:::error
    Validate -->|OK| Log1[処理開始ログ]:::log

    Log1 --> BuildContext[コンテキスト構築]:::process
    BuildContext --> CallGemini[Gemini API呼び出し]:::gemini

    CallGemini -->|成功| ParseResponse[レスポンス解析]:::process
    CallGemini -->|失敗| Error2[エラー処理]:::error

    ParseResponse --> UpdateSuccess[AppSheet更新<br/>ステータス: 編集中]:::appsheet
    UpdateSuccess --> Log2[処理完了ログ]:::log
    Log2 --> End([成功レスポンス]):::success

    Error2 --> UpdateError[AppSheet更新<br/>ステータス: エラー]:::appsheet
    UpdateError --> SendMail[エラー通知メール]:::process
    SendMail --> ErrorEnd([エラーレスポンス]):::error

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef gemini fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef appsheet fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#fff
```

## 2. Webhook受信処理

```mermaid
sequenceDiagram
    participant AS as AppSheet
    participant WH as doPost()
    participant CW as CommonWebhook
    participant PR as processRequest()

    AS->>WH: POST リクエスト
    WH->>CW: handleDoPost(e, processFunction)
    CW->>CW: parseRequest(e)
    Note over CW: JSONパース<br/>タイムスタンプ追加

    CW->>PR: processFunction(params)
    Note over PR: reportId, clientName,<br/>targetMonth, visitRecords,<br/>staffId

    PR-->>CW: 処理結果
    CW->>CW: createSuccessResponse(result)
    CW-->>WH: JSONレスポンス
    WH-->>AS: HTTPレスポンス
```

## 3. Gemini API呼び出しフロー

```mermaid
graph TB
    Start([generateReportWithGemini]):::entry --> BuildPrompt[プロンプト構築]:::process

    BuildPrompt --> CallAPI[Gemini API呼び出し]:::gemini

    CallAPI --> CheckStatus{HTTPステータス}:::decision
    CheckStatus -->|200| ParseJSON[JSON解析]:::process
    CheckStatus -->|4xx/5xx| APIError[APIエラー]:::error

    ParseJSON --> ValidateResponse{候補データ<br/>存在確認}:::decision
    ValidateResponse -->|あり| ExtractText[テキスト抽出]:::process
    ValidateResponse -->|なし| NoCandidate[候補なしエラー]:::error

    ExtractText --> LogAPI[API呼び出しログ]:::log
    LogAPI --> Return([生成テキスト返却]):::success

    APIError --> Return
    NoCandidate --> Return

    classDef entry fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef gemini fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#fff
```

## 4. 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> 受付: Webhook受信

    受付 --> 処理中: パラメータ検証OK
    受付 --> エラー: パラメータ不足

    処理中 --> Gemini呼び出し: コンテキスト構築完了

    Gemini呼び出し --> レスポンス解析: API成功(200)
    Gemini呼び出し --> エラー: API失敗(4xx/5xx)

    レスポンス解析 --> AppSheet更新: テキスト抽出成功
    レスポンス解析 --> エラー: 候補データなし

    AppSheet更新 --> 編集中: status="編集中"
    AppSheet更新 --> エラー: API失敗

    編集中 --> [*]: 成功レスポンス返却

    エラー --> AppSheetエラー更新: reportId存在
    エラー --> [*]: reportIdなし

    AppSheetエラー更新 --> メール通知: status="エラー"
    メール通知 --> [*]: エラーレスポンス返却
```

## 5. コンポーネント構成図

```mermaid
graph TB
    subgraph "エントリーポイント"
        doPost[doPost]:::webhook
        testFunc[testReportGeneration]:::test
    end

    subgraph "共通モジュール"
        CommonWebhook[CommonWebhook]:::common
        ErrorHandler[ErrorHandler]:::common
        DuplicationPrevention[DuplicationPrevention]:::common
    end

    subgraph "メイン処理"
        processRequest[processRequest]:::main
        generateReport[generateReportWithGemini]:::main
    end

    subgraph "AppSheet連携"
        updateSuccess[updateReportOnSuccess]:::appsheet
        updateError[updateReportOnError]:::appsheet
        callAPI[callAppSheetApi]:::appsheet
    end

    subgraph "ユーティリティ"
        logger[utils_logger.gs]:::util
        config[config_settings.gs]:::util
    end

    subgraph "通知"
        sendMail[sendErrorEmail]:::mail
    end

    doPost --> CommonWebhook
    CommonWebhook --> processRequest
    testFunc --> processRequest

    processRequest --> logger
    processRequest --> generateReport
    processRequest --> updateSuccess
    processRequest --> updateError
    processRequest --> sendMail

    generateReport --> logger
    generateReport --> config

    updateSuccess --> callAPI
    updateError --> callAPI

    callAPI --> logger
    callAPI --> config

    sendMail --> logger
    sendMail --> config

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef test fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    classDef common fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef main fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef appsheet fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef util fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
    classDef mail fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
```

---

**最終更新**: 2025-10-18  
**バージョン**: v2.0.0
