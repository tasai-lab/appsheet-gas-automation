# 予算アラート設定手順（月5000円）

## Cloud Console経由での設定

### 1. Cloud Consoleにアクセス

```
https://console.cloud.google.com/billing/budgets?project=fractal-ecosystem
```

### 2. 予算を作成

1. 「予算を作成」ボタンをクリック

2. **範囲**:
   - プロジェクト: `fractal-ecosystem` を選択

3. **金額**:
   - 予算タイプ: 指定した金額
   - ターゲット金額: `5000` JPY
   - 期間: 月次

4. **アクション**:
   - アラート閾値の設定:
     - 50% (2,500円): メール通知
     - 90% (4,500円): メール通知
     - 100% (5,000円): メール通知

5. **通知**:
   - 通知チャネル管理 → メール通知
   - メールアドレス: `t.asai@fractal-group.co.jp`
   - (オプション) Slack通知も設定可能

6. **予算名**:
   - 名前: `RAG System Monthly Budget`

7. 「保存」をクリック

### 3. 確認

設定後、以下を確認:
- [ ] 予算が作成されていること
- [ ] アラート閾値が正しく設定されていること
- [ ] 通知先メールアドレスが正しいこと
- [ ] テスト通知が届くこと（設定から「テスト通知を送信」）

---

## gcloud CLIでの確認

予算設定後、以下のコマンドで確認可能:

```bash
# 請求アカウント確認
gcloud billing accounts list

# プロジェクトの請求アカウント確認
gcloud billing projects describe fractal-ecosystem
```

---

## Terraform での自動化（将来対応）

```hcl
# budget.tf
resource "google_billing_budget" "rag_system_budget" {
  billing_account = "015AD0-335C1D-ECD651"
  display_name    = "RAG System Monthly Budget"

  budget_filter {
    projects = ["projects/411046620715"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = "5000"
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 0.9
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.id,
    ]
  }
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification"
  type         = "email"

  labels = {
    email_address = "t.asai@fractal-group.co.jp"
  }
}
```

---

**最終更新**: 2025-10-27
