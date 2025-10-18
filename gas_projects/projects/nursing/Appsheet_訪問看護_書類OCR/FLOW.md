# Appsheet_訪問看護_書類OCR - 処理フロー図

本ドキュメントでは、書類OCR + 書類仕分け統合システムの処理フローを図解します。

## 1. メイン処理フロー（統合版）

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([Webhook受信<br/>documentType指定]):::webhook --> Validate{documentType<br/>検証}:::decision

    Validate -->|不正| Error1[エラー応答]:::error
    Validate -->|OK| DupCheck{重複チェック}:::decision

    DupCheck -->|重複| Skip[スキップ応答]:::skip
    DupCheck -->|新規| Lock[処理中に設定]:::process

    Lock --> BuildPrompt[documentType別<br/>プロンプト生成]:::process

    BuildPrompt --> CallGemini[★Gemini API呼び出し<br/>1回のみ]:::gemini

    CallGemini --> Parse[レスポンス解析<br/>OCR + structured_data]:::process

    Parse --> UpdateDoc[書類管理テーブル更新<br/>ocr_text, summary, title]:::appsheet
    UpdateDoc --> RenameFile[ファイル名変更]:::process
    RenameFile --> CheckData{structured_data<br/>存在?}:::decision

    CheckData -->|あり| UpdateSpecific[種類別テーブル更新<br/>医療保険証/介護保険証/公費等]:::appsheet
    CheckData -->|なし| Complete[処理完了]:::process

    UpdateSpecific --> Notify[完了通知メール]:::notification
    Notify --> Complete
    Complete --> Success([成功応答]):::success

    CallGemini -->|失敗| Error2[エラー処理]:::error
    Error2 --> ErrorEnd([エラー応答]):::error

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef gemini fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef appsheet fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef notification fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#fff
    classDef skip fill:#3a3a3a,stroke:#888,stroke-width:2px,color:#fff
```

## 2. Gemini API呼び出し詳細（1回で完結）

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([documentType受信]):::input --> Prompt[documentType別<br/>プロンプト生成]:::process

    Prompt --> Schema[スキーマ定義追加]:::process

    Schema --> Examples[出力例を含む]:::process

    Examples --> API[Gemini API呼び出し<br/>generateContent]:::gemini

    API --> Response[JSON レスポンス受信]:::process

    Response --> Extract{JSON抽出}:::decision

    Extract -->|成功| Parse[パース完了]:::process
    Extract -->|失敗| Error[JSON抽出エラー]:::error

    Parse --> Result{データ検証}:::decision

    Result -->|OK| Return([ocr_text<br/>summary<br/>title<br/>structured_data]):::success
    Result -->|NG| Error

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef gemini fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef error fill:#5f1e3a,stroke:#e24a90,stroke-width:3px,color:#fff
```

## 3. 書類仕分け処理フロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([structured_data受信]):::input --> Check{データ存在?}:::decision

    Check -->|null| Skip[仕分けスキップ]:::skip
    Check -->|あり| Type{documentType判定}:::decision

    Type -->|医療保険証| Medical[医療保険証レコード作成<br/>Client_Medical_Insurances]:::appsheet
    Type -->|介護保険証| LTCI[介護保険証レコード作成<br/>Client_LTCI_Insurances]:::appsheet
    Type -->|公費| Subsidy[公費レコード作成<br/>Client_Public_Subsidies]:::appsheet
    Type -->|口座情報| Bank[口座情報レコード作成<br/>Client_Bank_Accounts]:::appsheet
    Type -->|指示書| Instruction[指示書レコード作成<br/>VN_Instructions]:::appsheet
    Type -->|負担割合証| Copay[負担割合証レコード作成<br/>Client_LTCI_Copayment_Certificates]:::appsheet
    Type -->|その他| Other[未対応]:::warn

    Medical --> Return([recordId返却]):::success
    LTCI --> Return
    Subsidy --> Return
    Bank --> Return
    Instruction --> Return
    Copay --> Return
    Other --> Return
    Skip --> Null([null返却]):::skip

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef appsheet fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef skip fill:#3a3a3a,stroke:#888,stroke-width:2px,color:#fff
    classDef warn fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
```

## 4. 完了通知メール送信フロー

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    Start([レコード作成完了]):::input --> Check{通知設定確認}:::decision

    Check -->|未設定| Skip[送信スキップ]:::skip
    Check -->|設定済み| Build[HTML メール本文作成]:::process

    Build --> Link1[AppSheetディープリンク生成]:::process
    Link1 --> Link2[Googleドライブリンク生成]:::process
    Link2 --> Table[抽出データテーブル作成]:::process

    Table --> Send[MailApp.sendEmail]:::email

    Send --> Result{送信結果}:::decision

    Result -->|成功| Log1[ログ記録：成功]:::log
    Result -->|失敗| Log2[ログ記録：失敗]:::log

    Log1 --> End([完了]):::success
    Log2 --> End
    Skip --> End

    classDef input fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef decision fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef process fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef email fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef log fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
    classDef success fill:#1e5f3a,stroke:#4ae290,stroke-width:3px,color:#fff
    classDef skip fill:#3a3a3a,stroke:#888,stroke-width:2px,color:#fff
```

## 5. 従来版との比較

### 従来版（2回のAPI呼び出し）

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    participant AS as AppSheet
    participant OCR as 書類OCR
    participant CLASS as 書類仕分け
    participant G as Gemini API
    participant DB as AppSheet DB

    AS->>OCR: Webhook (fileId)
    OCR->>G: ★1回目: OCR実行
    G-->>OCR: ocr_text, summary, title
    OCR->>DB: 書類管理テーブル更新
    OCR-->>AS: 完了

    Note over AS,CLASS: 別のワークフロー

    AS->>CLASS: Webhook (ocr_text, documentType)
    CLASS->>G: ★2回目: 構造化データ抽出
    G-->>CLASS: structured_data
    CLASS->>DB: 種類別テーブル更新
    CLASS-->>AS: 完了

    Note over AS,DB: 合計2回のGemini API呼び出し
```

### 統合版（1回のAPI呼び出し）

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    participant AS as AppSheet
    participant INT as 統合システム
    participant G as Gemini API
    participant DB as AppSheet DB

    AS->>INT: Webhook (fileId, documentType)
    INT->>G: ★1回のみ: OCR + 構造化データ抽出
    Note over INT,G: documentType別のプロンプト<br/>出力スキーマ指定
    G-->>INT: ocr_text, summary, title,<br/>structured_data
    INT->>DB: 書類管理テーブル更新
    INT->>DB: 種類別テーブル更新
    INT->>INT: 完了通知メール送信
    INT-->>AS: 完了

    Note over AS,DB: 合計1回のGemini API呼び出し<br/>コスト50%削減、処理時間短縮
```

## 6. モジュール構成図

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    subgraph "エントリーポイント"
        doPost[doPost]:::webhook
        testFunc[testProcessRequest]:::test
    end

    subgraph "メイン処理"
        main[processRequest]:::main
        update1[updateDocumentOnSuccess]:::main
        update2[updateDocumentOnError]:::main
        rename[renameFile]:::main
    end

    subgraph "Gemini API連携"
        analyze[analyzeDocumentWithGemini]:::gemini
        prompt[generatePrompt]:::gemini
        schema[getStructuredDataSchema]:::gemini
    end

    subgraph "書類仕分け"
        process[processStructuredData]:::processor
        medical[createMedicalInsuranceRecord]:::processor
        ltci[createLtciInsuranceRecord]:::processor
        subsidy[createPublicSubsidyRecord]:::processor
    end

    subgraph "通知"
        error[sendErrorEmail]:::notify
        complete[sendCompletionNotificationEmail]:::notify
    end

    subgraph "共通モジュール"
        webhook[CommonWebhook]:::common
        logger[utils_logger]:::common
        config[config_settings]:::common
    end

    doPost --> webhook
    webhook --> main
    testFunc --> main

    main --> analyze
    main --> update1
    main --> update2
    main --> rename
    main --> process
    main --> complete
    main --> error

    analyze --> prompt
    prompt --> schema

    process --> medical
    process --> ltci
    process --> subsidy

    main --> logger
    main --> config
    analyze --> logger
    analyze --> config
    process --> logger
    process --> config
    complete --> config
    error --> config

    classDef webhook fill:#1e3a5f,stroke:#4a90e2,stroke-width:2px,color:#fff
    classDef test fill:#5f5f1e,stroke:#e2e24a,stroke-width:2px,color:#fff
    classDef main fill:#5f1e5f,stroke:#e24ae2,stroke-width:2px,color:#fff
    classDef gemini fill:#1e5f3a,stroke:#4ae290,stroke-width:2px,color:#fff
    classDef processor fill:#5f3a1e,stroke:#e2904a,stroke-width:2px,color:#fff
    classDef notify fill:#5f4c1e,stroke:#e2a84a,stroke-width:2px,color:#fff
    classDef common fill:#1e5f5f,stroke:#4ae2e2,stroke-width:2px,color:#fff
```

---

**最終更新**: 2025-10-18
**バージョン**: v2.0.0
