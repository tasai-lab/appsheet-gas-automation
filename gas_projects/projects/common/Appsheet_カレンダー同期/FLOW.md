# Appsheet_カレンダー同期 - 処理フロー図

**Version:** 1.0.0
**Last Updated:** 2025-10-27

---

## 全体フロー

```mermaid
graph TB
    Start([Googleカレンダー<br>イベント変更]) --> Trigger[Calendar Trigger]
    Trigger --> Main[onCalendarChanged]
    Main --> Lock{UserLock<br>取得成功?}
    Lock -->|失敗| End1([エラーログ記録<br>終了])
    Lock -->|成功| Sync[syncCalendarEvents]
    Sync --> Process[processEventChanges]
    Process --> AppSheet[AppSheet API<br>バッチ更新]
    AppSheet --> AuditLog[Event_Audit_Log<br>記録]
    AuditLog --> UnifiedLog[統合ログシート<br>保存]
    UnifiedLog --> ReleaseLock[ロック解放]
    ReleaseLock --> End2([処理完了])

    style Start fill:#e1f5ff
    style Trigger fill:#fff4e1
    style Main fill:#e8f5e9
    style Lock fill:#fff9c4
    style Sync fill:#e8f5e9
    style Process fill:#e8f5e9
    style AppSheet fill:#f3e5f5
    style AuditLog fill:#e0f2f1
    style UnifiedLog fill:#e0f2f1
    style End1 fill:#ffebee
    style End2 fill:#e8f5e9
```

---

## onCalendarChanged - メイン処理フロー

```mermaid
sequenceDiagram
    participant Cal as Googleカレンダー
    participant Trig as Calendar Trigger
    participant Main as onCalendarChanged
    participant Lock as LockService
    participant Sync as syncCalendarEvents
    participant Process as processEventChanges
    participant AS as AppSheet API
    participant Log as Event_Audit_Log
    participant ULog as 統合ログシート

    Cal->>Trig: イベント変更
    Trig->>Main: トリガー起動
    Main->>Lock: UserLock取得試行

    alt ロック取得成功
        Lock-->>Main: ロック取得
        Main->>Sync: カレンダー同期開始
        Sync->>Cal: イベント差分取得 (Calendar API)
        Cal-->>Sync: イベント配列 + nextSyncToken
        Sync->>Process: イベント処理開始

        Process->>Process: 期間フィルタリング<br>(過去2日〜未来1年)
        Process->>Process: Schedule_Plan検索
        Process->>Process: 更新行準備

        Process->>AS: バッチ更新
        AS-->>Process: 更新結果

        Process->>Log: 監査ログ記録
        Log-->>Process: 記録完了

        Process-->>Main: 処理完了
        Main->>ULog: 統合ログ保存
        Main->>Lock: ロック解放

    else ロック取得失敗
        Lock-->>Main: タイムアウト
        Main->>ULog: エラーログ保存
    end

    Main-->>Trig: 処理終了
```

---

## syncCalendarEvents - 同期トークンフロー

```mermaid
flowchart TD
    Start([syncCalendarEvents開始]) --> GetToken[UserProperties<br>から同期トークンを取得]
    GetToken --> HasToken{同期トークン<br>あり?}

    HasToken -->|なし| FullSync[全イベント取得<br>maxResults=1000]
    HasToken -->|あり| DiffSync[差分イベント取得<br>syncToken使用]

    FullSync --> CallAPI[Calendar API呼び出し]
    DiffSync --> CallAPI

    CallAPI --> CheckError{APIエラー?}
    CheckError -->|Sync token invalid| ResetToken[トークンリセット]
    ResetToken --> FullSync

    CheckError -->|その他エラー| Error([エラー終了])
    CheckError -->|成功| HasPage{nextPageToken<br>あり?}

    HasPage -->|あり| CallAPI
    HasPage -->|なし| HasEvents{イベント<br>あり?}

    HasEvents -->|あり| ProcessEvents[processEventChanges]
    HasEvents -->|なし| SaveToken

    ProcessEvents --> SaveToken[nextSyncToken保存]
    SaveToken --> End([処理完了])

    style Start fill:#e1f5ff
    style GetToken fill:#fff4e1
    style HasToken fill:#fff9c4
    style FullSync fill:#e8f5e9
    style DiffSync fill:#e8f5e9
    style CallAPI fill:#f3e5f5
    style CheckError fill:#fff9c4
    style ResetToken fill:#ffebee
    style Error fill:#ffebee
    style HasPage fill:#fff9c4
    style HasEvents fill:#fff9c4
    style ProcessEvents fill:#e8f5e9
    style SaveToken fill:#e0f2f1
    style End fill:#e8f5e9
```

---

## processEventChanges - イベント処理フロー

```mermaid
flowchart TD
    Start([processEventChanges開始]) --> Init[スプレッドシート初期化<br>スタッフマップ取得]
    Init --> CalcPeriod[処理対象期間を計算<br>過去2日〜未来1年]

    CalcPeriod --> FilterLoop{イベント<br>ループ}
    FilterLoop -->|各イベント| CheckType{変更タイプ判定}

    CheckType -->|CREATED| FilterLoop
    CheckType -->|UPDATED| CheckPeriodUpdate{期間内?}
    CheckType -->|DELETED| CollectID

    CheckPeriodUpdate -->|期間外| FilterLoop
    CheckPeriodUpdate -->|期間内| CollectID[イベントID収集]
    CollectID --> FilterLoop

    FilterLoop -->|完了| SearchPlan[Schedule_Plan<br>から該当データ検索]
    SearchPlan --> PrepareLoop{処理済み<br>イベントループ}

    PrepareLoop -->|各イベント| ExistsInPlan{Schedule_Plan<br>に存在?}
    ExistsInPlan -->|なし| PrepareLoop
    ExistsInPlan -->|あり| CheckDeleted{DELETED?}

    CheckDeleted -->|はい| CheckPeriodDelete{元データの<br>期間内?}
    CheckPeriodDelete -->|期間外| PrepareLoop
    CheckPeriodDelete -->|期間内| CreateLog

    CheckDeleted -->|いいえ| PrepareUpdate[AppSheet更新行準備]
    PrepareUpdate --> CreateLog[監査ログエントリー作成]
    CreateLog --> PrepareLoop

    PrepareLoop -->|完了| HasUpdates{更新行<br>あり?}
    HasUpdates -->|あり| CallAppSheet[AppSheet API<br>バッチ更新]
    HasUpdates -->|なし| WriteLog

    CallAppSheet --> UpdateStatus[ログエントリーに<br>更新ステータス反映]
    UpdateStatus --> WriteLog[Event_Audit_Log<br>一括書き込み]
    WriteLog --> End([処理完了])

    style Start fill:#e1f5ff
    style Init fill:#fff4e1
    style CalcPeriod fill:#fff4e1
    style FilterLoop fill:#fff9c4
    style CheckType fill:#fff9c4
    style CheckPeriodUpdate fill:#fff9c4
    style CollectID fill:#e8f5e9
    style SearchPlan fill:#e8f5e9
    style PrepareLoop fill:#fff9c4
    style ExistsInPlan fill:#fff9c4
    style CheckDeleted fill:#fff9c4
    style CheckPeriodDelete fill:#fff9c4
    style PrepareUpdate fill:#e8f5e9
    style CreateLog fill:#e0f2f1
    style HasUpdates fill:#fff9c4
    style CallAppSheet fill:#f3e5f5
    style UpdateStatus fill:#e0f2f1
    style WriteLog fill:#e0f2f1
    style End fill:#e8f5e9
```

---

## Webアプリ - ユーザー有効化フロー

```mermaid
flowchart TD
    Start([ユーザーがWebアプリ<br>にアクセス]) --> DoGet[doGet関数実行]
    DoGet --> ShowHTML[WebApp.html表示]

    ShowHTML --> UserClick{ユーザー操作}
    UserClick -->|Activate| Activate[activateUserSyncWebApp]
    UserClick -->|Deactivate| Deactivate[deactivateUserSyncWebApp]
    UserClick -->|Check Status| CheckStatus[checkUserSyncStatusWebApp]

    Activate --> CheckSheets[スプレッドシート<br>アクセス権限確認]
    CheckSheets --> CheckError1{エラー?}
    CheckError1 -->|あり| Error1([エラーメッセージ返却])
    CheckError1 -->|なし| CheckTrigger{既存トリガー<br>あり?}

    CheckTrigger -->|あり| InfoExists([既に有効<br>メッセージ返却])
    CheckTrigger -->|なし| CreateTrigger[カレンダートリガー作成<br>onCalendarChanged]
    CreateTrigger --> SaveLog1[統合ログ保存]
    SaveLog1 --> Success1([成功メッセージ返却])

    Deactivate --> GetTrigger[ユーザーの<br>トリガーを取得]
    GetTrigger --> HasTrigger2{トリガー<br>あり?}
    HasTrigger2 -->|なし| InfoNone([既に無効<br>メッセージ返却])
    HasTrigger2 -->|あり| DeleteTrigger[トリガー削除]
    DeleteTrigger --> DeleteToken[同期トークン削除]
    DeleteToken --> SaveLog2[統合ログ保存]
    SaveLog2 --> Success2([成功メッセージ返却])

    CheckStatus --> GetTrigger2[ユーザーの<br>トリガーを取得]
    GetTrigger2 --> ReturnStatus([ステータス返却])

    style Start fill:#e1f5ff
    style DoGet fill:#fff4e1
    style ShowHTML fill:#fff4e1
    style UserClick fill:#fff9c4
    style Activate fill:#e8f5e9
    style Deactivate fill:#e8f5e9
    style CheckStatus fill:#e8f5e9
    style CheckSheets fill:#fff4e1
    style CheckError1 fill:#fff9c4
    style CheckTrigger fill:#fff9c4
    style CreateTrigger fill:#f3e5f5
    style SaveLog1 fill:#e0f2f1
    style SaveLog2 fill:#e0f2f1
    style GetTrigger fill:#fff4e1
    style GetTrigger2 fill:#fff4e1
    style HasTrigger2 fill:#fff9c4
    style DeleteTrigger fill:#f3e5f5
    style DeleteToken fill:#fff4e1
    style Success1 fill:#e8f5e9
    style Success2 fill:#e8f5e9
    style InfoExists fill:#e1f5ff
    style InfoNone fill:#e1f5ff
    style ReturnStatus fill:#e1f5ff
    style Error1 fill:#ffebee
```

---

## 管理者機能 - メール送信フロー

```mermaid
flowchart TD
    Start([管理者が<br>メニューをクリック]) --> OnOpen[onOpen関数実行]
    OnOpen --> Menu[管理者メニュー表示]
    Menu --> Click[承認依頼メール<br>を送信クリック]

    Click --> SendFunc[sendAuthorizationEmails]
    SendFunc --> GetURL[WebアプリURL取得]

    GetURL --> HasURL{URL<br>あり?}
    HasURL -->|なし| ErrorNoURL([エラー:<br>未デプロイ])
    HasURL -->|あり| Confirm{確認ダイアログ<br>YES?}

    Confirm -->|NO| Cancel([キャンセル])
    Confirm -->|YES| GetStaff[Staff_Members<br>からメール取得]

    GetStaff --> HasStaff{スタッフ<br>あり?}
    HasStaff -->|なし| InfoNoStaff([情報:<br>対象なし])
    HasStaff -->|あり| BuildEmail[メール本文作成]

    BuildEmail --> SendMail[MailApp.sendEmail<br>一括送信]
    SendMail --> SaveLog[統合ログ保存]
    SaveLog --> ShowSuccess([成功ダイアログ表示])

    style Start fill:#e1f5ff
    style OnOpen fill:#fff4e1
    style Menu fill:#fff4e1
    style Click fill:#fff4e1
    style SendFunc fill:#e8f5e9
    style GetURL fill:#fff4e1
    style HasURL fill:#fff9c4
    style Confirm fill:#fff9c4
    style GetStaff fill:#fff4e1
    style HasStaff fill:#fff9c4
    style BuildEmail fill:#e8f5e9
    style SendMail fill:#f3e5f5
    style SaveLog fill:#e0f2f1
    style ShowSuccess fill:#e8f5e9
    style ErrorNoURL fill:#ffebee
    style Cancel fill:#e0e0e0
    style InfoNoStaff fill:#e1f5ff
```

---

## データフロー

```mermaid
graph LR
    Calendar[Googleカレンダー] -->|変更検知| GAS[GAS<br>onCalendarChanged]
    GAS -->|イベント取得| CalAPI[Calendar API]
    CalAPI -->|差分イベント| GAS

    GAS -->|検索| Plan[(Schedule_Plan<br>スプレッドシート)]
    Plan -->|該当データ| GAS

    GAS -->|更新| ASLib[AppSheetSecureConnector<br>ライブラリ]
    ASLib -->|バッチ更新| AppSheet[AppSheet<br>Schedule_Plan]

    GAS -->|監査ログ| AuditLog[(Event_Audit_Log<br>スプレッドシート)]
    GAS -->|実行ログ| ULog[(統合ログシート<br>コスト管理)]

    StaffMaster[(Staff_Members<br>スプレッドシート)] -->|メール→ID変換| GAS

    style Calendar fill:#e1f5ff
    style GAS fill:#e8f5e9
    style CalAPI fill:#f3e5f5
    style Plan fill:#fff4e1
    style ASLib fill:#f3e5f5
    style AppSheet fill:#e1f5ff
    style AuditLog fill:#fff4e1
    style ULog fill:#fff4e1
    style StaffMaster fill:#fff4e1
```

---

## エラーハンドリングフロー

```mermaid
flowchart TD
    Start([処理開始]) --> TryCatch{try-catch}

    TryCatch -->|正常| NormalProcess[通常処理]
    NormalProcess --> SetSuccess[status='成功']
    SetSuccess --> Finally

    TryCatch -->|例外| CatchBlock[catch ブロック]
    CatchBlock --> SetError[status='エラー']
    SetError --> LogError[logger.error<br>エラー詳細記録]
    LogError --> Finally

    Finally[finally ブロック] --> SaveLog[logger.saveToSpreadsheet<br>統合ログ保存]
    SaveLog --> End([処理終了])

    style Start fill:#e1f5ff
    style TryCatch fill:#fff9c4
    style NormalProcess fill:#e8f5e9
    style SetSuccess fill:#e8f5e9
    style CatchBlock fill:#ffebee
    style SetError fill:#ffebee
    style LogError fill:#ffebee
    style Finally fill:#e0f2f1
    style SaveLog fill:#e0f2f1
    style End fill:#e8f5e9
```

---

## カラーコード凡例

- 🔵 **開始/終了**: `#e1f5ff`
- 🟡 **設定/初期化**: `#fff4e1`
- 🟢 **処理**: `#e8f5e9`
- 🟨 **判定/分岐**: `#fff9c4`
- 🟣 **外部API**: `#f3e5f5`
- 🔷 **ログ/保存**: `#e0f2f1`
- 🔴 **エラー**: `#ffebee`
- ⚪ **キャンセル**: `#e0e0e0`
