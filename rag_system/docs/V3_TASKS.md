# RAG V3 タスクバックログ

**作成日**: 2025-10-28
**総タスク数**: 25タスク
**総見積もり工数**: 42日

---

## Phase 0: 準備（3日間）

### Task 0.1: 設計レビュー

**Priority**: 🔴 High
**Component**: Documentation
**Complexity**: Small
**Estimated**: 1日

**Description**:
NEW_ARCHITECTURE_V3.md のレビューとステークホルダー承認

**Checklist**:
- [ ] 設計書レビュー（Backend Lead）
- [ ] 設計書レビュー（Frontend Lead）
- [ ] ステークホルダーフィードバック収集
- [ ] 技術選定の最終確認
- [ ] リスク評価とミティゲーション計画策定

**Acceptance Criteria**:
- [ ] 設計書が承認された
- [ ] 全技術選定が確定
- [ ] リスク一覧が文書化された

**References**:
- [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md)
- [MIGRATION_ROADMAP_V3.md](MIGRATION_ROADMAP_V3.md)

---

### Task 0.2: 開発環境準備

**Priority**: 🔴 High
**Component**: Infrastructure
**Complexity**: Small
**Estimated**: 1日

**Description**:
GCP プロジェクト設定とローカル開発環境セットアップ

**Checklist**:
- [ ] GCP プロジェクト設定確認（fractal-ecosystem）
- [ ] Cloud SQL for MySQL API有効化
- [ ] VPC ネットワーク設定
- [ ] Cloud SQL Proxy インストール
- [ ] MySQL Workbench インストール
- [ ] `.env` ファイルテンプレート作成

**Acceptance Criteria**:
- [ ] GCP APIs有効化完了
- [ ] ローカルからCloud SQL接続確認
- [ ] 開発環境構築手順書作成

**References**:
- GCP Cloud SQL: https://cloud.google.com/sql/docs

---

### Task 0.3: Cloud SQL インスタンス作成

**Priority**: 🔴 High
**Component**: Infrastructure
**Complexity**: Medium
**Estimated**: 1日

**Description**:
Cloud SQL for MySQL インスタンス作成と初期設定

**Checklist**:
- [ ] インスタンス作成（db-n1-standard-2、MySQL 9.0）
- [ ] データベース `rag_system` 作成
- [ ] ユーザー作成・権限設定
- [ ] SSL証明書ダウンロード
- [ ] Private IP設定
- [ ] バックアップ設定（7日保持、自動）
- [ ] Cloud Monitoring設定
- [ ] 接続テスト

**Acceptance Criteria**:
- [ ] Cloud SQL稼働中
- [ ] Private IP接続確認
- [ ] SSL接続確認
- [ ] バックアップ動作確認

**Resources**:
- インスタンススペック: db-n1-standard-2（2 vCPU、7.5GB RAM）
- ストレージ: 50GB SSD
- MySQL Version: 9.0（Vector Type サポート）

---

## Phase 1: データベース移行（10日間）

### Task 1.1: スキーマ作成

**Priority**: 🔴 High
**Component**: Database
**Complexity**: Medium
**Estimated**: 2日

**Description**:
MySQL スキーマ作成（Vector Type使用）

**Checklist**:
- [ ] `knowledge_base` テーブル作成
- [ ] `embeddings` テーブル作成（VECTOR(2048)）
- [ ] `clients` テーブル作成
- [ ] `chat_sessions` テーブル作成
- [ ] `chat_messages` テーブル作成
- [ ] インデックス作成（B-Tree、Vector Index）
- [ ] 外部キー制約設定
- [ ] テーブル権限設定
- [ ] スキーマドキュメント作成

**Acceptance Criteria**:
- [ ] 全テーブル作成完了
- [ ] Vector Indexが動作確認
- [ ] 外部キー制約が正しく設定
- [ ] `schema.sql` 作成完了

**Implementation Files**:
```
backend/database/schema.sql
backend/database/migrations/001_create_tables.sql
backend/database/migrations/002_create_indexes.sql
backend/database/README.md
```

**References**:
- MySQL Vector Type: https://dev.mysql.com/doc/refman/9.0/en/vector-functions.html
- Schema Design: [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md#31-cloud-sql-mysql-スキーマ)

---

### Task 1.2: 移行スクリプト開発

**Priority**: 🔴 High
**Component**: Backend
**Complexity**: Large
**Estimated**: 3日

**Description**:
Spreadsheet/Firestore → MySQL データ移行スクリプト開発

**Checklist**:
- [ ] Spreadsheet KnowledgeBase → MySQL 移行スクリプト
- [ ] Spreadsheet Embeddings → MySQL 移行スクリプト
- [ ] Firestore ChatHistory → MySQL 移行スクリプト
- [ ] データ検証スクリプト
- [ ] ロールバックスクリプト
- [ ] 進捗モニタリング機能
- [ ] エラーハンドリング
- [ ] ログ出力
- [ ] ドライラン機能

**Acceptance Criteria**:
- [ ] 全データソースから移行可能
- [ ] データ整合性チェック合格
- [ ] ロールバック動作確認
- [ ] ドキュメント完備

**Implementation Files**:
```
backend/scripts/migrate_to_mysql.py
backend/scripts/validate_migration.py
backend/scripts/rollback_migration.py
backend/scripts/migration_config.py
```

**References**:
- Migration Guide: [MIGRATION_ROADMAP_V3.md](MIGRATION_ROADMAP_V3.md#task-12-移行スクリプト開発3日)

---

### Task 1.3: テストデータ移行

**Priority**: 🟡 Medium
**Component**: Backend
**Complexity**: Small
**Estimated**: 2日

**Description**:
テストデータ（100件）を使った移行リハーサル

**Checklist**:
- [ ] テストデータ抽出（各ドメイン25件ずつ）
- [ ] 移行スクリプト実行
- [ ] データ検証実行
- [ ] パフォーマンステスト（検索速度測定）
- [ ] 問題修正
- [ ] 移行手順書更新

**Acceptance Criteria**:
- [ ] テストデータ移行成功
- [ ] データ整合性100%
- [ ] 検索速度 < 2秒
- [ ] テスト移行レポート作成

**Test Cases**:
- nursing: 25件
- clients: 25件
- calls: 25件
- sales: 25件

---

### Task 1.4: 本番データ移行

**Priority**: 🔴 High
**Component**: Backend
**Complexity**: Large
**Estimated**: 3日

**Description**:
全データ（3,151件 + 増分）の本番移行実行

**Checklist**:
- [ ] 移行前バックアップ（Spreadsheet、Firestore）
- [ ] ダウンタイム通知（ステークホルダー）
- [ ] 本番データ移行実行
- [ ] データ整合性チェック
- [ ] パフォーマンス検証
- [ ] ロールバックテスト
- [ ] 移行完了レポート作成

**Acceptance Criteria**:
- [ ] 全3,151+件移行完了
- [ ] データ整合性100%
- [ ] 検索速度 < 2秒
- [ ] Vector Index正常動作

**Rollback Plan**:
1. Cloud SQL インスタンス停止
2. Spreadsheet/Firestore に切り戻し
3. アプリケーション設定更新
4. ヘルスチェック確認

---

## Phase 2: Backend実装（12日間）

### Task 2.1: MySQL接続層実装

**Priority**: 🔴 High
**Component**: Backend
**Complexity**: Medium
**Estimated**: 3日

**Description**:
MySQL接続クライアントとORM設定

**Checklist**:
- [ ] MySQLClient クラス実装
- [ ] コネクションプーリング設定（10並列）
- [ ] SQLAlchemy ORM設定
- [ ] トランザクション管理
- [ ] エラーハンドリング（リトライなし）
- [ ] ヘルスチェック機能
- [ ] 単体テスト作成
- [ ] ドキュメント作成

**Acceptance Criteria**:
- [ ] Cloud SQL接続成功
- [ ] コネクションプール動作確認
- [ ] 単体テストカバレッジ > 80%
- [ ] エラーハンドリング動作確認

**Implementation Files**:
```
backend/app/services/mysql_client.py
backend/app/database/connection.py
backend/app/models/database.py
backend/tests/test_mysql_client.py
```

**References**:
- Code Example: [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md#task-21-mysql接続層実装3日)

---

### Task 2.2: プロンプト最適化実装

**Priority**: 🔴 High
**Component**: Backend
**Complexity**: Medium
**Estimated**: 3日

**Description**:
Gemini 2.5 Flash-Lite によるプロンプト最適化サービス

**Checklist**:
- [ ] PromptOptimizer クラス実装
- [ ] Gemini 2.5 Flash-Lite 統合
- [ ] 利用者情報組み込みロジック
- [ ] 時間表現の自動変換
- [ ] 医療用語展開
- [ ] エラーハンドリング（graceful degradation）
- [ ] キャッシング機構（類似プロンプト）
- [ ] 単体テスト作成
- [ ] ドキュメント作成

**Acceptance Criteria**:
- [ ] プロンプト最適化成功率 > 95%
- [ ] 最適化処理時間 < 1秒
- [ ] 単体テストカバレッジ > 80%
- [ ] エラー時は元のプロンプトを返す

**Implementation Files**:
```
backend/app/services/prompt_optimizer.py
backend/tests/test_prompt_optimizer.py
```

**Test Cases**:
| Input | Expected Output |
|-------|----------------|
| "直近の変化を教えて" | "山田太郎さん（利用者ID: user_001）の2025年10月21日から2025年10月28日の状態変化を教えてください" |
| "バルーン使ってる?" | "山田太郎さん（利用者ID: user_001）の膀胱留置カテーテル（バルーン）の使用状況を教えてください" |

**References**:
- Design: [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md#41-gemini-25-flash-lite-の役割)

---

### Task 2.3: RAG Engine V3実装

**Priority**: 🔴 High
**Component**: Backend
**Complexity**: Large
**Estimated**: 4日

**Description**:
RAG Engine V3（MySQL Vector Search + Prompt Optimization）

**Checklist**:
- [ ] RAGEngineV3 クラス実装
- [ ] プロンプト最適化統合
- [ ] MySQL Vector Search統合
- [ ] Vertex AI Ranking API統合（リランキング）
- [ ] エラーハンドリング
- [ ] ログ記録・監視
- [ ] パフォーマンス最適化
- [ ] 単体テスト作成
- [ ] 統合テスト作成
- [ ] ドキュメント作成

**Acceptance Criteria**:
- [ ] 検索レイテンシ < 2秒
- [ ] Top 20結果返却成功
- [ ] 単体テストカバレッジ > 80%
- [ ] 統合テスト合格

**Implementation Files**:
```
backend/app/services/rag_engine_v3.py
backend/tests/test_rag_engine_v3.py
backend/tests/integration/test_search_e2e.py
```

**Performance Target**:
- Step 1（Prompt Optimization）: < 1秒
- Step 2（Vectorize）: < 0.5秒
- Step 3（Vector Search）: < 0.5秒
- Step 4（Reranking）: < 1秒
- **Total**: < 2秒

**References**:
- Implementation: [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md#521-新しいragengine)

---

### Task 2.4: ストリーミング改善

**Priority**: 🟡 Medium
**Component**: Backend
**Complexity**: Medium
**Estimated**: 2日

**Description**:
Gemini 2.5 Flash（思考モード）統合とSSE最適化

**Checklist**:
- [ ] Gemini 2.5 Flash（思考モード）統合
- [ ] SSEストリーミング最適化
- [ ] 進捗ステータス送信（optimizing, searching, reranking, generating）
- [ ] エラーハンドリング改善
- [ ] バッファリング防止（`await asyncio.sleep(0)`）
- [ ] ストリーミングテスト作成
- [ ] ドキュメント作成

**Acceptance Criteria**:
- [ ] ストリーミング初回チャンク < 1秒
- [ ] 全チャンク送信成功
- [ ] 進捗バー同期動作確認
- [ ] エラー時の適切なメッセージ

**Implementation Files**:
```
backend/app/routers/chat_v3.py
backend/app/services/gemini_service_v3.py
backend/tests/test_streaming.py
```

**References**:
- Current Implementation: [backend/app/routers/chat.py](../backend/app/routers/chat.py)

---

## Phase 3: Frontend実装（7日間）

### Task 3.1: 進捗バー実装

**Priority**: 🟡 Medium
**Component**: Frontend
**Complexity**: Small
**Estimated**: 2日

**Description**:
SSE進捗同期のポップアップ進捗バー実装

**Checklist**:
- [ ] ProgressBar コンポーネント作成
- [ ] useProgress カスタムHook作成
- [ ] SSEイベントリスナー統合
- [ ] ステージ別進捗表示（10% → 30% → 60% → 80% → 100%）
- [ ] アニメーション・スタイリング（Tailwind CSS）
- [ ] レスポンシブ対応
- [ ] アクセシビリティ対応（ARIA属性）
- [ ] Storybookストーリー作成
- [ ] 単体テスト作成

**Acceptance Criteria**:
- [ ] 進捗バーが各ステージで更新
- [ ] スムーズなアニメーション
- [ ] モバイル対応
- [ ] アクセシビリティスコア100

**Implementation Files**:
```
frontend/src/components/ProgressBar.tsx
frontend/src/hooks/useProgress.ts
frontend/src/components/ProgressBar.stories.tsx
frontend/tests/ProgressBar.test.tsx
```

**Design Reference**:
- [NEW_ARCHITECTURE_V3.md](NEW_ARCHITECTURE_V3.md#71-進捗バーの同期)

---

### Task 3.2: API統合

**Priority**: 🔴 High
**Component**: Frontend
**Complexity**: Medium
**Estimated**: 3日

**Description**:
Backend V3 APIエンドポイント統合

**Checklist**:
- [ ] API クライアント作成（`api_v3.ts`）
- [ ] useChatV3 カスタムHook作成
- [ ] SSEストリーミング受信処理
- [ ] エラーハンドリング
- [ ] ローディング状態管理
- [ ] リトライ機構（指数バックオフ）
- [ ] TypeScript型定義
- [ ] 単体テスト作成
- [ ] 統合テスト作成

**Acceptance Criteria**:
- [ ] Backend V3 API通信成功
- [ ] SSEメッセージ正常受信
- [ ] エラー時の適切な表示
- [ ] TypeScript型エラーなし

**Implementation Files**:
```
frontend/src/lib/api_v3.ts
frontend/src/hooks/useChatV3.ts
frontend/src/types/api_v3.ts
frontend/tests/api_v3.test.ts
```

---

### Task 3.3: UI/UX調整

**Priority**: 🟢 Low
**Component**: Frontend
**Complexity**: Small
**Estimated**: 2日

**Description**:
レイアウト調整とUX改善

**Checklist**:
- [ ] レイアウト調整（ChatContainer、Sidebar）
- [ ] レスポンシブ対応確認（Mobile、Tablet、Desktop）
- [ ] アクセシビリティ改善（WCAG 2.1 AA準拠）
- [ ] ダークモード対応
- [ ] ローディング状態のUX改善
- [ ] エラーメッセージの改善
- [ ] ユーザーフィードバック収集

**Acceptance Criteria**:
- [ ] Lighthouseスコア > 90
- [ ] アクセシビリティスコア > 90
- [ ] モバイル動作確認
- [ ] ダークモード動作確認

---

## Phase 4: テスト・デプロイ（6日間）

### Task 4.1: 統合テスト

**Priority**: 🔴 High
**Component**: Testing
**Complexity**: Medium
**Estimated**: 2日

**Description**:
エンドツーエンドテスト実行

**Checklist**:
- [ ] E2Eテストシナリオ作成
- [ ] プロンプト最適化テスト
- [ ] 検索精度テスト
- [ ] ストリーミングテスト
- [ ] 進捗バーテスト
- [ ] エラーシナリオテスト
- [ ] パフォーマンステスト
- [ ] セキュリティテスト
- [ ] テストレポート作成

**Acceptance Criteria**:
- [ ] 全E2Eテスト合格
- [ ] バグ0件
- [ ] テストカバレッジ > 80%

**Test Cases**:
1. 通常検索フロー
2. プロンプト最適化フロー
3. ストリーミング回答生成
4. エラーハンドリング
5. タイムアウト処理

**Implementation Files**:
```
backend/tests/integration/test_e2e_search.py
backend/tests/integration/test_streaming.py
frontend/cypress/integration/test_chat_v3.spec.ts
```

---

### Task 4.2: パフォーマンステスト

**Priority**: 🔴 High
**Component**: Testing
**Complexity**: Medium
**Estimated**: 2日

**Description**:
パフォーマンスベンチマーク実行

**Checklist**:
- [ ] 検索レイテンシ測定（目標: 1-2秒）
- [ ] ストリーミング初回チャンク測定（目標: 1秒以内）
- [ ] 全体処理時間測定（目標: 5-8秒）
- [ ] 同時接続負荷テスト（10, 50, 100ユーザー）
- [ ] ボトルネック分析
- [ ] 最適化実施
- [ ] ベンチマークレポート作成

**Acceptance Criteria**:
- [ ] 検索レイテンシ < 2秒
- [ ] ストリーミング初回チャンク < 1秒
- [ ] 全体処理時間 < 8秒
- [ ] 同時50ユーザー対応

**Performance Targets**:
| Metric | Target |
|--------|--------|
| 検索レイテンシ | 1-2秒 |
| ストリーミング初回チャンク | 1秒以内 |
| 全体処理時間 | 5-8秒 |
| 同時接続数 | 50ユーザー |

**Implementation Files**:
```
backend/scripts/benchmark_v3.py
backend/scripts/load_test.py
```

---

### Task 4.3: 本番デプロイ

**Priority**: 🔴 High
**Component**: DevOps
**Complexity**: Medium
**Estimated**: 2日

**Description**:
本番環境へのデプロイ実行

**Checklist**:
- [ ] Cloud Run デプロイ（Backend）
- [ ] Vercel デプロイ（Frontend）
- [ ] 環境変数設定（本番）
- [ ] Cloud SQL 接続設定
- [ ] SSL証明書設定
- [ ] Cloud Armor設定（DDoS対策）
- [ ] Cloud Monitoring設定
- [ ] Cloud Logging設定
- [ ] アラート設定
- [ ] ヘルスチェック確認
- [ ] ロールバック計画確認
- [ ] デプロイ完了レポート作成

**Acceptance Criteria**:
- [ ] 本番環境稼働
- [ ] ヘルスチェック合格
- [ ] モニタリング動作確認
- [ ] ロールバック手順確認

**Rollback Plan**:
1. Cloud Run リビジョンロールバック
2. Vercel デプロイロールバック
3. 環境変数復元
4. ヘルスチェック確認

**Deployment Scripts**:
```
backend/deploy.sh
frontend/deploy.sh
scripts/rollback.sh
```

---

## サマリー

### タスク統計

| Phase | タスク数 | 見積もり工数 |
|-------|---------|------------|
| Phase 0 | 3 | 3日 |
| Phase 1 | 4 | 10日 |
| Phase 2 | 4 | 12日 |
| Phase 3 | 3 | 7日 |
| Phase 4 | 3 | 6日 |
| **合計** | **17** | **38日** |

### 優先度別

- 🔴 High: 13タスク
- 🟡 Medium: 3タスク
- 🟢 Low: 1タスク

### コンポーネント別

- Backend: 7タスク
- Frontend: 3タスク
- Database: 1タスク
- Infrastructure: 2タスク
- Testing: 2タスク
- DevOps: 1タスク
- Documentation: 1タスク

---

**最終更新**: 2025-10-28
**次回レビュー**: 週次（毎週月曜日）
