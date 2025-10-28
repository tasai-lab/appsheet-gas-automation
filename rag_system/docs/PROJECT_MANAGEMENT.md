# RAG V3 プロジェクト管理ガイド

**作成日**: 2025-10-28
**対象**: 開発チーム全員

---

## 📋 タスク管理フロー

### 1. タスク作成

**GitHub Issueを使用**

#### Issue テンプレート

##### Feature Issue
```markdown
## 機能概要
[簡潔な機能説明]

## 背景・目的
[なぜこの機能が必要か]

## 要件
- [ ] 要件1
- [ ] 要件2
- [ ] 要件3

## 実装詳細
[技術的な実装内容]

## 受け入れ基準
- [ ] 基準1
- [ ] 基準2
- [ ] テストケース追加

## 参照ドキュメント
- [MIGRATION_ROADMAP_V3.md](../docs/MIGRATION_ROADMAP_V3.md)
- [NEW_ARCHITECTURE_V3.md](../docs/NEW_ARCHITECTURE_V3.md)

## 優先度
🔴 High / 🟡 Medium / 🟢 Low

## 見積もり工数
X日

## 担当者
@username
```

##### Bug Issue
```markdown
## 問題の説明
[バグの詳細]

## 再現手順
1. ステップ1
2. ステップ2
3. ステップ3

## 期待される動作
[正しい動作の説明]

## 実際の動作
[現在の誤った動作]

## 環境
- OS:
- Browser:
- Version:

## エラーログ
```
[エラーログを貼り付け]
```

## 影響範囲
🔴 Critical / 🟡 Major / 🟢 Minor

## 優先度
🔴 High / 🟡 Medium / 🟢 Low
```

### 2. タスクのラベル付け

**必須ラベル:**

- **Phase**: `phase-0`, `phase-1`, `phase-2`, `phase-3`, `phase-4`
- **Type**: `feature`, `bug`, `documentation`, `infrastructure`
- **Priority**: `priority-high`, `priority-medium`, `priority-low`
- **Status**: `todo`, `in-progress`, `review`, `done`, `blocked`

**オプションラベル:**

- **Component**: `backend`, `frontend`, `database`, `devops`
- **Complexity**: `complexity-small`, `complexity-medium`, `complexity-large`

### 3. タスクの進捗管理

**GitHub Project Board使用**

#### カラム構成

1. **Backlog**: 未着手タスク
2. **Todo**: 今週着手予定
3. **In Progress**: 作業中
4. **Review**: コードレビュー待ち
5. **Testing**: QAテスト中
6. **Done**: 完了

#### タスクの移動ルール

- **Backlog → Todo**: 週次計画で割り当て
- **Todo → In Progress**: 作業開始時
- **In Progress → Review**: PRオープン時
- **Review → Testing**: PRマージ後
- **Testing → Done**: テスト合格後

---

## 🔄 開発ワークフロー

### ブランチ戦略

**Git Flow使用**

```
main
├── develop
│   ├── feature/task-001-cloud-sql-setup
│   ├── feature/task-002-prompt-optimizer
│   └── feature/task-003-rag-engine-v3
└── hotfix/fix-streaming-issue
```

#### ブランチ命名規則

- **Feature**: `feature/task-{issue-number}-{short-description}`
- **Bugfix**: `bugfix/issue-{issue-number}-{short-description}`
- **Hotfix**: `hotfix/fix-{short-description}`
- **Release**: `release/v3.0.0`

### コミットメッセージ

**Conventional Commits形式**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**例:**
```
feat(backend): implement PromptOptimizer service

- Add Gemini 2.5 Flash-Lite integration
- Implement client info embedding logic
- Add time expression auto-conversion

Closes #42
```

**Types:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードフォーマット
- `refactor`: リファクタリング
- `test`: テスト追加
- `chore`: ビルド・設定変更

### プルリクエスト

#### PR テンプレート

```markdown
## 変更内容
[変更の概要]

## 関連Issue
Closes #XXX

## 変更の種類
- [ ] 新機能
- [ ] バグ修正
- [ ] リファクタリング
- [ ] ドキュメント
- [ ] その他

## テスト
- [ ] 単体テスト追加
- [ ] 統合テスト追加
- [ ] 手動テスト実施

## チェックリスト
- [ ] コードがスタイルガイドに準拠
- [ ] ドキュメント更新済み
- [ ] エラー記録（必要な場合）
- [ ] パフォーマンス影響なし
- [ ] セキュリティ影響なし

## スクリーンショット（該当する場合）
[画像を貼り付け]

## 追加の注記
[その他の情報]
```

#### レビュープロセス

1. **Self Review**: PR作成者自身がレビュー
2. **Peer Review**: 最低1名のレビュー必須
3. **Approval**: Approve後にマージ可能
4. **CI/CD**: 全テスト合格必須

---

## 📊 進捗報告

### 日次スタンドアップ（非同期）

**毎日 10:00 までに Slackに投稿**

```
【昨日の成果】
- タスクA完了
- タスクB 50%進捗

【今日の予定】
- タスクC着手
- タスクD完了予定

【ブロッカー】
- なし / XYZの件で相談したい
```

### 週次レビュー

**毎週月曜日 10:00**

**議題:**
1. 前週の成果確認
2. 今週の目標設定
3. ブロッカー・リスク確認
4. リソース調整

**成果物:**
- 週次レポート（Notion/Confluence）
- ロードマップ更新

### マイルストーンレビュー

**各フェーズ完了時**

**議題:**
1. マイルストーン達成度評価
2. 次フェーズの準備確認
3. リスク再評価
4. ステークホルダー報告

**成果物:**
- マイルストーンレポート
- 次フェーズの詳細計画

---

## 🛠️ 開発環境セットアップ

### Backend

```bash
cd backend

# Python 3.11+ 必須
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
cp .env.example .env
# .env を編集（Cloud SQL接続情報等）

# データベースマイグレーション
python scripts/migrate_to_mysql.py

# 開発サーバー起動
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Node.js 18+ 必須
npm install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集（API URL等）

# 開発サーバー起動
npm run dev
```

---

## 📝 ドキュメント管理

### ドキュメントの種類

1. **設計書**: アーキテクチャ、API仕様
2. **ロードマップ**: プロジェクト計画
3. **エラーログ**: 問題記録・解決策
4. **運用手順**: デプロイ、監視

### ドキュメント更新ルール

- **コード変更時**: 関連ドキュメント同時更新
- **週次**: README.md、CHANGELOG.md 更新
- **フェーズ完了時**: アーキテクチャ決定記録（ADR）追加

### ドキュメントレビュー

- **重要ドキュメント**: 最低2名レビュー
- **軽微な修正**: 1名レビューでOK

---

## 🔍 コードレビューガイドライン

### レビュー観点

1. **機能性**: 要件を満たしているか
2. **可読性**: コードが理解しやすいか
3. **保守性**: 将来の変更が容易か
4. **パフォーマンス**: 性能問題はないか
5. **セキュリティ**: 脆弱性はないか
6. **テスト**: 十分なカバレッジか

### レビューコメント形式

**Conventional Comments使用**

```
<label>: <subject>

<body>
```

**Labels:**
- `praise`: 良いコード
- `nitpick`: 些細な指摘
- `suggestion`: 改善提案
- `issue`: 必須修正
- `question`: 質問

**例:**
```
suggestion: この部分はヘルパー関数に分離できます

可読性向上のため、以下のようにリファクタリングを提案します:
```python
def extract_client_info(data):
    ...
```
```

---

## 🧪 テスト戦略

### テストレベル

1. **Unit Test**: 個別関数・メソッド
2. **Integration Test**: API・DB統合
3. **E2E Test**: ユーザーシナリオ
4. **Performance Test**: ベンチマーク

### カバレッジ目標

- **Backend**: 80%以上
- **Frontend**: 70%以上
- **Critical Path**: 100%

### テスト実行

```bash
# Backend
cd backend
pytest tests/ --cov=app --cov-report=html

# Frontend
cd frontend
npm run test
npm run test:e2e
```

---

## 🚀 デプロイプロセス

### 開発環境

**自動デプロイ（develop ブランチ）**

- **Backend**: Cloud Run（dev環境）
- **Frontend**: Vercel（Preview Deploy）

### ステージング環境

**手動デプロイ（release ブランチ）**

- **Backend**: Cloud Run（staging環境）
- **Frontend**: Vercel（Staging）

### 本番環境

**承認制デプロイ（main ブランチ）**

1. Release PR作成
2. ステークホルダー承認
3. デプロイ実行
4. ヘルスチェック確認
5. ロールバック待機（1時間）

---

## 🆘 トラブルシューティング

### よくある問題

#### 1. Cloud SQL接続エラー

**症状**: `Can't connect to MySQL server`

**解決策**:
```bash
# Cloud SQL Proxyを起動
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:3306
```

#### 2. ベクトル検索が遅い

**症状**: 検索が5秒以上かかる

**解決策**:
```sql
-- インデックス作成確認
SHOW INDEX FROM embeddings;

-- インデックス再作成
CREATE VECTOR INDEX idx_embedding ON embeddings(embedding)
  DISTANCE METRIC COSINE
  NLIST 100;
```

#### 3. ストリーミングが途切れる

**症状**: SSEメッセージが途中で止まる

**解決策**:
```python
# バッファリング無効化
await asyncio.sleep(0)  # イベントループに制御を戻す
```

### エスカレーション

**重大な問題**: `ERROR_LOG.md` に記録 + Slackで即座に報告

---

## 📞 連絡先

### チーム連絡先

- **Slack**: `#rag-v3-project`
- **Email**: rag-team@example.com
- **緊急連絡**: PM直通（電話）

### ミーティング

- **日次スタンドアップ**: 非同期（Slack）
- **週次レビュー**: 月曜 10:00-11:00（Google Meet）
- **フェーズレビュー**: フェーズ完了時（2時間）

---

## 🎯 プロジェクト成功のためのベストプラクティス

### DO ✅

1. **エラーは即座に記録**: `ERROR_LOG.md` に詳細を記録
2. **小さなPR**: 1つのPRは300行以下
3. **早期テスト**: コード完成前にテスト作成
4. **ドキュメント同期**: コード変更時に同時更新
5. **コミュニケーション**: 不明点は即座に質問

### DON'T ❌

1. **API呼び出しのリトライループ**: 絶対禁止（1回のみ実行）
2. **大きなPR**: 500行以上のPRは分割
3. **テスト後回し**: コード完成後のテスト追加
4. **暗黙の仮定**: 不明点を放置
5. **単独作業**: 重要な決定は必ず相談

---

**最終更新**: 2025-10-28
**次回レビュー**: 2025-11-04