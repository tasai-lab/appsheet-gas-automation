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

    classDef webhook fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef gemini fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef appsheet fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef log fill:#e0f2f1,stroke:#004d40,stroke-width:2px
    classDef success fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
    classDef error fill:#ffcdd2,stroke:#c62828,stroke-width:3px
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

    classDef entry fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef gemini fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef log fill:#e0f2f1,stroke:#004d40,stroke-width:2px
    classDef success fill:#c8e6c9,stroke:#2e7d32,stroke-width:3px
    classDef error fill:#ffcdd2,stroke:#c62828,stroke-width:3px
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

    classDef webhook fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef test fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef common fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef main fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef appsheet fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef util fill:#e0f2f1,stroke:#004d40,stroke-width:2px
    classDef mail fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

---

**最終更新**: 2025-10-18  
**バージョン**: v2.0.0
