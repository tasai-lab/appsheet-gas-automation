# RAGシステム - Claude Code プロジェクトガイド

**プロジェクト**: 医療特化型RAG（Retrieval-Augmented Generation）システム
**現在**: V3移行プロジェクト進行中（Phase 0: 準備）
**期間**: 2025-10-28 〜 2025-12-09（6週間、27人日）
**技術スタック**: Next.js 14 + FastAPI + Vertex AI + Cloud SQL MySQL 9.0
**最終更新**: 2025-10-28

---

## 🎯 V3プロジェクト - クイック概要

### 主要な変更点

| 項目 | V2（完了） | V3（移行中） | 改善率 |
|------|-----------|------------|-------|
| **データベース** | Firestore | **Cloud SQL (MySQL 9.0)** | - |
| **検索速度** | 3-5秒 | **1-2秒** | **50-60%** ↑ |
| **プロンプト最適化** | なし | **Gemini 2.5 Flash-Lite** | 新機能 |
| **検索結果数** | 10件 | **20件** | **100%** ↑ |
| **回答生成** | Flash | **Flash + 思考モード** | 精度向上 |
| **進捗表示** | なし | **リアルタイム進捗バー** | 新機能 |

### 📋 V3必読ドキュメント（優先順）

1. **[V3_SUMMARY.md](../docs/V3_SUMMARY.md)** ⭐ まずこれを読む - プロジェクト総合サマリー
2. **[V3_PROGRESS.md](../docs/V3_PROGRESS.md)** ⭐ 毎日更新 - リアルタイム進捗追跡
3. **[V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md)** - 技術設計書（19KB、Cloud SQL設計）
4. **[V3_ROADMAP.md](../docs/V3_ROADMAP.md)** - 6週間ロードマップ（4フェーズ）
5. **[V3_TASKS.md](../docs/V3_TASKS.md)** - タスクバックログ（17タスク詳細）
6. **[TEAM_ASSIGNMENT.md](../docs/TEAM_ASSIGNMENT.md)** - チーム役割分担（4名推奨）
7. **[PROJECT_MANAGEMENT.md](../docs/PROJECT_MANAGEMENT.md)** - 開発ワークフロー

### 🚀 現在のフェーズ: Phase 0 - 準備（Week 1）

**期間**: 2025-10-28（月）〜 2025-10-31（木）、3日間

#### 今週のタスク（Phase 0）

- [ ] **Task 0.1: 設計レビュー**（1日、優先度: 🔴 最高）
  - Backend Lead: [V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md) Section 3（DB設計）レビュー
  - Frontend Lead: Section 7（進捗バーUI）レビュー
  - DevOps: Section 3.1（Cloud SQL構成）レビュー
  - ステークホルダー承認取得

- [ ] **Task 0.2: 開発環境準備**（1日、優先度: 🔴）
  - GCPプロジェクト設定確認
  - Cloud SQL for MySQL API有効化
  - ローカル開発環境セットアップ手順書作成

- [ ] **Task 0.3: Cloud SQL インスタンス作成**（1日、優先度: 🔴）
  - インスタンス作成（db-n1-standard-2、vCPU 2、メモリ7.5GB）
  - データベース作成（rag_system）、ユーザー設定（rag_user）
  - SSL設定、接続テスト

**次のマイルストーン**: M1: 環境構築完了（2025-11-01）

**進捗確認**: [V3_PROGRESS.md](../docs/V3_PROGRESS.md) で週次進捗・リスクを追跡

---

## 🚀 クイックスタート

### よく使うコマンド

**開発環境管理:**
- `/start-dev` - Backend + Frontend 同時起動
- `/kill-dev` - 全開発サーバー停止
- `/restart-dev` - 開発サーバー再起動

**テスト・検証:**
- `/test-backend` - Backend単体テスト実行
- `/test-frontend` - Frontend単体テスト実行
- `/check-api-calls` - API呼び出し回数確認

**データ管理:**
- `/vectorize-data` - ナレッジベースのベクトル化

**ドキュメント:**
- `/update-docs` - ドキュメント更新

---

## ⚠️ 最重要な制約

### 1. API呼び出し: リトライループ厳禁

**絶対に禁止:**
```python
# ❌ 絶対に書かない
for attempt in range(3):  # リトライループ
    try:
        result = api_call()
        break
    except:
        continue
```

**正しいパターン:**
```python
# ✅ 1回のみ実行
try:
    result = await api_call()  # 1回のみ
except Exception as e:
    logger.error(f"API呼び出し失敗: {e}")
    raise  # 即座にraise
```

**理由**: 過去に200,000+ API呼び出し/日の事故発生（参照: [ERROR_LOG.md](../docs/ERROR_LOG.md)）

### 2. エラー記録: 全てのエラーを ERROR_LOG.md に記録

必須項目:
- 発生日時
- 問題の内容（症状・根本原因・影響範囲）
- 原因分析
- 解決策
- 再発防止策
- 教訓

### 3. セキュリティ: 個人情報保護

- ログ出力時はマスキング必須
- 医療情報・利用者名は絶対にログに出力しない
- 詳細: [07_SECURITY.md](../docs/07_SECURITY.md)

---

## 📁 プロジェクト構造（V3対応）

```
rag_system/
├── docs/                          # ドキュメント（32個→12個に最適化、-69%）
│   ├── README.md                  # ドキュメントインデックス
│   │
│   ├── V3_SUMMARY.md              # ⭐ V3プロジェクト総合サマリー
│   ├── V3_ARCHITECTURE.md         # V3アーキテクチャ設計書（Cloud SQL設計）
│   ├── V3_ROADMAP.md              # 6週間ロードマップ（Gantt図付き）
│   ├── V3_TASKS.md                # タスクバックログ（17タスク詳細）
│   ├── V3_PROGRESS.md             # ⭐ リアルタイム進捗追跡（毎日更新）
│   ├── TEAM_ASSIGNMENT.md         # チーム役割分担（2名/4名構成）
│   ├── PROJECT_MANAGEMENT.md      # 開発ワークフロー（Git Flow、PR）
│   │
│   ├── 01_PROJECT_OVERVIEW.md     # プロジェクト概要
│   ├── 04_API_SPECIFICATION.md    # API仕様
│   ├── 07_SECURITY.md             # セキュリティ設計
│   ├── ERROR_LOG.md               # ⭐ エラー記録（必読）
│   └── DECISIONS.md               # アーキテクチャ決定記録
│
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── routers/              # APIルーター
│   │   ├── services/             # ビジネスロジック
│   │   │   ├── rag_engine_v3.py  # ← V3で新規追加
│   │   │   ├── mysql_client.py   # ← V3で新規追加
│   │   │   ├── prompt_optimizer.py # ← V3で更新
│   │   │   └── gemini_service_v3.py # ← V3で新規追加
│   │   ├── database/             # ← V3で新規追加
│   │   │   ├── connection.py
│   │   │   └── models.py
│   │   └── config.py
│   ├── sql/                       # ← V3で新規追加
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── README.md
│   ├── scripts/                   # データ移行スクリプト
│   │   ├── migrate_to_mysql.py   # ← V3で新規追加
│   │   └── validate_migration.py # ← V3で新規追加
│   ├── tests/
│   └── requirements.txt
│
├── frontend/                      # Next.js Frontend
│   ├── src/
│   │   ├── app/                  # App Router
│   │   ├── components/
│   │   │   ├── ChatContainer.tsx
│   │   │   └── ProgressBar.tsx   # ← V3で新規追加
│   │   ├── contexts/
│   │   ├── hooks/
│   │   │   └── useProgress.ts    # ← V3で新規追加
│   │   └── lib/
│   └── package.json
│
└── .claude/                       # Claude Code設定
    ├── CLAUDE.md                 # このファイル（プロジェクト管理者向け）
    └── commands/                 # カスタムコマンド
```

---

## 📖 ドキュメント体系

### V3プロジェクトドキュメント（7個）

- **[V3_SUMMARY.md](../docs/V3_SUMMARY.md)** - プロジェクト総合サマリー（12KB）
- **[V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md)** - 技術設計書（19KB）
- **[V3_ROADMAP.md](../docs/V3_ROADMAP.md)** - 6週間ロードマップ（20KB）
- **[V3_TASKS.md](../docs/V3_TASKS.md)** - タスクバックログ（17KB）
- **[V3_PROGRESS.md](../docs/V3_PROGRESS.md)** - リアルタイム進捗追跡
- **[TEAM_ASSIGNMENT.md](../docs/TEAM_ASSIGNMENT.md)** - チーム役割分担
- **[PROJECT_MANAGEMENT.md](../docs/PROJECT_MANAGEMENT.md)** - 開発ワークフロー（10KB）

### コアドキュメント（5個）

- **[01_PROJECT_OVERVIEW.md](../docs/01_PROJECT_OVERVIEW.md)** - プロジェクト概要
- **[04_API_SPECIFICATION.md](../docs/04_API_SPECIFICATION.md)** - API仕様
- **[07_SECURITY.md](../docs/07_SECURITY.md)** - セキュリティ設計
- **[ERROR_LOG.md](../docs/ERROR_LOG.md)** ⭐ エラー記録（必読）
- **[DECISIONS.md](../docs/DECISIONS.md)** - アーキテクチャ決定記録

---

## 🔄 開発ワークフロー

### 新機能開発

1. **タスク選択**: [V3_TASKS.md](../docs/V3_TASKS.md) から担当タスクを選択
2. **ブランチ作成**: `git checkout -b feature/task-X.Y` （例: `feature/task-2.2`）
3. **設計確認**: [V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md) の該当セクションを確認
4. **実装**: コーディング規約に従う
5. **テスト**: `/test-backend` または `/test-frontend`
6. **進捗更新**: [V3_PROGRESS.md](../docs/V3_PROGRESS.md) を更新 ⭐ **必須**
7. **PR作成**: [PROJECT_MANAGEMENT.md](../docs/PROJECT_MANAGEMENT.md) のPRテンプレートを使用
8. **レビュー**: チームメンバーレビュー → マージ

### 毎日の作業フロー

1. **朝**: [V3_PROGRESS.md](../docs/V3_PROGRESS.md) で本日のタスク確認
2. **実装**: タスクに集中
3. **昼**: 進捗をSlackで報告（Daily Standup形式）
4. **夕**: [V3_PROGRESS.md](../docs/V3_PROGRESS.md) を更新、ブロッカーを記録 ⭐ **必須**

### 📣 タスク完了時の進捗シェア（重要）

**⚠️ タスク完了時は必ず以下を実施してください:**

#### 1. V3_PROGRESS.md を即座に更新

```bash
# V3_PROGRESS.md を開く
open docs/V3_PROGRESS.md

# 完了タスクのチェックボックスを更新
- [x] Task X.Y: タスク名

# 進捗率を更新（該当セクション）
Phase X: [▰▰▰▰▱▱▱▱▱▱] 40% → 50%
```

#### 2. 完了報告をSlackに投稿

**テンプレート**:
```
✅ タスク完了報告

【タスク】: Task X.Y - タスク名
【完了日時】: YYYY-MM-DD HH:MM
【成果物】:
- ファイル名1（機能A実装）
- ファイル名2（テスト追加）

【次のタスク】: Task X.Y+1 - 次のタスク名
【見積】: X日

【ブロッカー】: なし / XYZの件で相談したい
```

#### 3. 日次報告（毎日EOD）

**必須項目**:
- 今日完了したタスク
- 明日の予定
- ブロッカー（あれば）

**投稿先**: Slackチャンネル（例: `#rag-v3-project`）

#### 4. 週次報告（毎週月曜）

**必須項目**:
- 先週完了したタスク数
- 主要成果物
- 今週の目標
- リスク・課題

**投稿先**: Slackチャンネル + [V3_PROGRESS.md](../docs/V3_PROGRESS.md) に記録

### 進捗シェアのベストプラクティス

**✅ 良い例**:
```
✅ Task 2.2完了

【タスク】: Task 2.2 - プロンプト最適化実装
【完了日時】: 2025-11-18 17:00
【成果物】:
- app/services/prompt_optimizer.py（220行）
- tests/test_prompt_optimizer.py（15テストケース）
- ドキュメント更新

【テスト結果】: 全15テストケース成功
【パフォーマンス】: プロンプト最適化 < 1秒（目標達成）

【次のタスク】: Task 2.3 - RAG Engine V3実装
【見積】: 4日

【ブロッカー】: なし
```

**❌ 悪い例**:
```
終わりました
```

### エラー対応フロー

1. **エラー記録開始**: [ERROR_LOG.md](../docs/ERROR_LOG.md) にエントリー作成
2. **原因調査**: ログ分析、コードレビュー
3. **解決策実施**: 修正コード実装
4. **エラー記録完了**: 原因・解決策・再発防止策・教訓を記載
5. **コミット**: `fix: ` プレフィックスでコミット
6. **進捗シェア**: Slackに修正完了を報告 ⭐ **必須**

---

## 💻 コーディング規約

### Python (FastAPI) - 推奨パターン

```python
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def function_name(param1: str) -> dict:
    """
    関数説明

    Args:
        param1: パラメータ説明

    Returns:
        戻り値説明

    Raises:
        Exception: エラー説明
    """
    try:
        # ★★★ API呼び出し: 1回のみ実行 ★★★
        logger.info("API呼び出し開始")
        result = await api_call()
        logger.info("API呼び出し成功")
        return result
    except Exception as e:
        logger.error(f"API呼び出し失敗: {e}")
        raise  # 即座にraise（リトライしない）
```

### TypeScript (Next.js) - 推奨パターン

```typescript
/**
 * 関数説明
 * @param param1 - パラメータ説明
 * @returns 戻り値説明
 */
export async function functionName(param1: string): Promise<Result> {
  try {
    // ★★★ API呼び出し: 1回のみ実行 ★★★
    console.log('[API] 呼び出し開始');
    const result = await apiCall();
    console.log('[API] 呼び出し成功');
    return result;
  } catch (error) {
    console.error('[API] 呼び出し失敗:', error);
    throw error;  // 即座にthrow（リトライしない）
  }
}
```

---

## ✅ デプロイ前チェックリスト

必ず全項目をチェックすること:

- [ ] `/test-backend` 成功
- [ ] `/test-frontend` 成功
- [ ] `/check-api-calls` で異常な増加なし
- [ ] [ERROR_LOG.md](../docs/ERROR_LOG.md) 更新（新規エラーがある場合）
- [ ] `/update-docs` 実行済み
- [ ] セキュリティチェック（個人情報マスキング確認）
- [ ] コミットメッセージに変更内容明記
- [ ] [V3_PROGRESS.md](../docs/V3_PROGRESS.md) の進捗率更新

---

## 🎯 プロジェクト進捗（2025-10-28時点）

### ✅ V2完了（2025-10-28）

- **Firestore Vector Search移植**: 3,151件、10-15倍高速化達成
- **会話履歴コンテキスト化**: Backend + Frontend統合完了
- **SSEストリーミング修正**: EventSource形式の問題を修正
- **API重複呼び出し問題**: ClientsContext導入で解決
- **キャッシュ実装**: API呼び出し67.5%削減、コスト76.1%削減達成

### 🔄 V3進行中（Phase 0: 準備）

**現在のマイルストーン**: M0: 設計完了 ✅ 100%

**Week 1タスク**（2025-10-28〜2025-11-03）:
- 10/28（月）: Task 0.1 設計レビュー開始
- 10/29（火）: チームアサイン、環境準備開始
- 10/30（水）: Cloud SQL作成準備
- 10/31（木）: Cloud SQL作成完了
- 11/01（金）: M1達成（環境構築完了）

**次のフェーズ**: Phase 1 - データベース移行（2025-11-04〜2025-11-14、10日間）

### 📊 V3パフォーマンス目標

- **検索速度**: 1-2秒（V2比 50-60%高速化）
- **ストリーミング初回チャンク**: 1秒以内
- **全体処理時間**: 5-8秒（V2: 10-15秒）
- **検索精度**: NDCG@10 = 0.90+（プロンプト最適化効果）

---

## 📚 関連リソース

### 公式ドキュメント

- [Vertex AI Generative AI](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Cloud SQL for MySQL](https://cloud.google.com/sql/docs/mysql)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js 14 Documentation](https://nextjs.org/docs)

### 内部ドキュメント

#### V3プロジェクト（最優先）
- **[V3_SUMMARY.md](../docs/V3_SUMMARY.md)** ⭐ まずはこれ
- **[V3_PROGRESS.md](../docs/V3_PROGRESS.md)** ⭐ 毎日確認
- **[V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md)** - 技術設計
- **[V3_ROADMAP.md](../docs/V3_ROADMAP.md)** - スケジュール
- **[V3_TASKS.md](../docs/V3_TASKS.md)** - タスク詳細
- **[TEAM_ASSIGNMENT.md](../docs/TEAM_ASSIGNMENT.md)** - 役割分担
- **[PROJECT_MANAGEMENT.md](../docs/PROJECT_MANAGEMENT.md)** - ワークフロー

#### コア
- **[README.md](../docs/README.md)** - ドキュメント全体構成
- **[ERROR_LOG.md](../docs/ERROR_LOG.md)** ⭐ 必読 - 過去のエラーと教訓
- **[01_PROJECT_OVERVIEW.md](../docs/01_PROJECT_OVERVIEW.md)** - プロジェクト概要
- **[04_API_SPECIFICATION.md](../docs/04_API_SPECIFICATION.md)** - API仕様

---

**最終更新**: 2025-10-28
**ドキュメント最適化**: 32個 → 12個（-69%）
**次回レビュー**: 毎週月曜日（進捗会議）
