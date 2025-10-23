# GCP Places API 有効化手順

## 概要

このプロジェクトでは、Google Places API (New) を使用して施設情報を取得します。APIを使用する前に、GCPプロジェクトでAPIを有効化し、適切なコスト管理設定を行う必要があります。

## 前提条件

- GCPプロジェクトが作成されていること
- プロジェクトID: `macro-shadow-458705-v8`（既存プロジェクトを使用）
- 請求先アカウントが設定されていること

## 手順1: GCPコンソールにアクセス

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクト選択: `macro-shadow-458705-v8`

## 手順2: Places API (New) を有効化

### 方法1: APIライブラリから有効化

1. **ナビゲーションメニュー** → **APIとサービス** → **ライブラリ**
2. 検索ボックスに「Places API (New)」と入力
3. **Places API (New)** をクリック
4. **有効にする** ボタンをクリック

### 方法2: gcloudコマンドで有効化

```bash
gcloud services enable places-backend.googleapis.com --project=macro-shadow-458705-v8
```

## 手順3: APIキーの確認

既存のAPIキーを使用します：

```
AIzaSyD-V_IwW1flPJif6eYFZPFjLpfonyLKT-Y
```

### APIキーの制限設定（推奨）

セキュリティとコスト管理のため、APIキーに制限を設定します：

1. **APIとサービス** → **認証情報**
2. 該当のAPIキーをクリック
3. **APIの制限** セクション：
   - **キーを制限** を選択
   - **Places API (New)** のみを選択
4. **アプリケーションの制限**（オプション）：
   - **HTTPリファラー** を選択
   - 許可するリファラーを追加（Google Apps Scriptの場合は不要）
5. **保存** をクリック

## 手順4: コスト管理の設定

### 4.1 予算アラートの設定

1. **ナビゲーションメニュー** → **お支払い** → **予算とアラート**
2. **予算を作成** をクリック
3. 以下を設定：
   - **予算名**: "Places API Monthly Budget"
   - **予算額**: 5,000円/月（推奨）
   - **アラート**: 50%, 90%, 100%でメール通知
4. **完了** をクリック

### 4.2 クォータ制限の設定

Places API (New) のクォータを制限します：

1. **APIとサービス** → **有効なAPI** → **Places API (New)**
2. **割り当て** タブをクリック
3. **リクエスト/日** の編集ボタンをクリック
4. 推奨設定：
   - **1日あたりのリクエスト数**: 1,000（必要に応じて調整）
   - **1分あたりのリクエスト数**: 100
5. **保存** をクリック

### 4.3 モニタリングダッシュボードの設定

1. **ナビゲーションメニュー** → **オペレーション** → **モニタリング**
2. **ダッシュボード** → **ダッシュボードを作成**
3. 以下のメトリクスを追加：
   - **API呼び出し回数**
   - **エラー率**
   - **レイテンシ**
   - **クォータ使用率**

## 手順5: Places API (New) の価格確認

### 現在の価格（2025年時点）

| API | 価格 | 無料枠 |
|-----|------|--------|
| Text Search (New) | $32 per 1,000 requests | 月額$200のクレジット |
| Place Details (New) | $17 per 1,000 requests | 月額$200のクレジット |

### コスト見積もり例

**1日100件の検索を実行する場合：**
- 1ヶ月: 100件/日 × 30日 = 3,000リクエスト
- コスト: 3,000 × $0.032 = $96 (約14,400円、為替レート150円)
- 無料枠適用後: $0（月額$200のクレジット内）

**注意:** 無料枠は新規ユーザー向けであり、既存プロジェクトでは適用されない場合があります。

## 手順6: APIキーをスクリプトに設定

既に `config.gs` に設定済みです：

```javascript
const PLACES_API_KEY = 'AIzaSyD-V_IwW1flPJif6eYFZPFjLpfonyLKT-Y';
```

セキュリティのため、本番環境ではScript Propertiesに保存することを推奨します：

```javascript
// Script Propertiesに保存
PropertiesService.getScriptProperties().setProperty('PLACES_API_KEY', 'YOUR_API_KEY');

// config.gsで取得
const PLACES_API_KEY = PropertiesService.getScriptProperties().getProperty('PLACES_API_KEY');
```

## コスト最適化のベストプラクティス

### 1. キャッシュの活用

同じ検索クエリの結果を24時間キャッシュすることで、重複API呼び出しを防ぎます。

**実装済み機能：**
- CacheServiceを使用した検索結果のキャッシュ（24時間）
- キャッシュキー: `places_${commonName}_${fullAddress}`

### 2. 既存データの確認

AppSheet APIで既に「確認済」の組織は、Places APIを呼び出さずにスキップします。

**実装済み機能：**
- `info_accuracy`が「確認済」の場合、処理をスキップ
- 実行ログに「既に確認済みのためスキップ」と記録

### 3. エラーハンドリング

Places APIで情報が見つからない場合、リトライせずにエラーを返します。

**実装済み機能：**
- 検索結果が0件の場合、即座にエラーを返す
- リトライなしで無駄なAPI呼び出しを防止

### 4. 実行ログでAPI呼び出し回数を追跡

すべてのPlaces API呼び出しを実行ログに記録し、コスト分析を可能にします。

**実装済み機能：**
- 実行ログに `places_api_calls` カラムを追加
- API呼び出し回数（0 or 1）を記録

## トラブルシューティング

### エラー: "API not enabled"

**原因:** Places API (New) が有効化されていない

**対処:**
1. GCPコンソールで Places API (New) を有効化
2. 数分待ってから再実行

### エラー: "The provided API key is invalid"

**原因:** APIキーが間違っているか、制限設定が不適切

**対処:**
1. APIキーが正しいことを確認
2. APIキーの制限設定で Places API (New) が許可されているか確認

### エラー: "RESOURCE_EXHAUSTED"

**原因:** APIクォータを超過

**対処:**
1. GCPコンソールでクォータ使用状況を確認
2. 必要に応じてクォータを増やす
3. キャッシュ機能が正しく動作しているか確認

## モニタリングとメンテナンス

### 定期的な確認項目

1. **API使用量の確認**（週次）
   - GCPコンソール → APIとサービス → ダッシュボード
   - 使用量が予算内に収まっているか確認

2. **実行ログの分析**（月次）
   - API呼び出し回数の合計を集計
   - エラー率を確認
   - キャッシュヒット率を確認（ログから算出）

3. **コストレポートの確認**（月次）
   - GCPコンソール → お支払い → レポート
   - Places APIのコストを確認
   - 予算内に収まっているか確認

## 参考リンク

- [Places API (New) ドキュメント](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Places API (New) 価格](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [GCP 予算アラート](https://cloud.google.com/billing/docs/how-to/budgets)
- [GCP クォータ管理](https://cloud.google.com/docs/quota)

## サポート

問題が発生した場合は、以下を確認してください：
1. GCP_SETUP.mdの手順を再確認
2. 実行ログスプレッドシートでエラー詳細を確認
3. GCPコンソールでAPI使用状況を確認
