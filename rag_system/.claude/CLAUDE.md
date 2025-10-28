# RAGシステム - Claude Code プロジェクトガイド

**プロジェクト**: 医療特化型RAG（Retrieval-Augmented Generation）システム
**技術スタック**: Next.js 14 + FastAPI + Vertex AI + Firestore
**最終更新**: 2025-10-28

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
- `/check-consistency` - 計画と実装の整合性チェック
- `/check-api-calls` - API呼び出し回数確認

**データ管理:**
- `/vectorize-data` - ナレッジベースのベクトル化

**デプロイ:**
- `/deploy-vercel` - Vercel デプロイ（Frontend）

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

**理由**: 過去に200,000+ API呼び出し/日の事故発生（参照: `docs/ERROR_LOG.md`）

### 2. エラー記録: 全てのエラーを docs/ERROR_LOG.md に記録

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
- 詳細: `docs/07_SECURITY.md`

---

## 📁 プロジェクト構造

```
rag_system/
├── docs/                          # ドキュメント（23個に最適化済み）
│   ├── README.md                  # ドキュメントインデックス
│   ├── 01_PROJECT_OVERVIEW.md     # プロジェクト概要
│   ├── 02_ARCHITECTURE.md         # アーキテクチャ
│   ├── 03_HYBRID_SEARCH_SPEC_V2.md # ハイブリッド検索仕様
│   ├── 04_API_SPECIFICATION.md    # API仕様
│   ├── 06_DEPLOYMENT.md           # デプロイ手順
│   ├── 07_SECURITY.md             # セキュリティ設計
│   ├── ERROR_LOG.md               # ⭐ エラー記録（必読）
│   ├── DECISIONS.md               # アーキテクチャ決定記録
│   └── ...                        # その他セットアップガイド等
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── routers/              # APIルーター
│   │   ├── services/             # ビジネスロジック
│   │   ├── middleware/           # 認証等
│   │   └── config.py             # 設定
│   ├── tests/                    # テスト
│   └── requirements.txt
├── frontend/                      # Next.js Frontend
│   ├── src/
│   │   ├── app/                  # App Router
│   │   ├── components/           # UIコンポーネント
│   │   ├── contexts/             # グローバル状態
│   │   └── lib/                  # ユーティリティ
│   └── package.json
├── scripts/                       # データ移行スクリプト
│   ├── migrate_to_firestore_vectors.py
│   └── ...
└── .claude/                       # Claude Code設定
    ├── CLAUDE.md                 # このファイル
    └── commands/                 # カスタムコマンド
```

---

## 📖 重要ドキュメント

### 必読ドキュメント（開発前）

1. **[docs/README.md](../docs/README.md)** - ドキュメント全体の構成・最新情報
2. **[docs/ERROR_LOG.md](../docs/ERROR_LOG.md)** - 過去のエラーと教訓（必読）
3. **[docs/02_ARCHITECTURE.md](../docs/02_ARCHITECTURE.md)** - システムアーキテクチャ
4. **[docs/04_API_SPECIFICATION.md](../docs/04_API_SPECIFICATION.md)** - APIエンドポイント仕様

### 機能別ドキュメント

- **ハイブリッド検索**: [docs/03_HYBRID_SEARCH_SPEC_V2.md](../docs/03_HYBRID_SEARCH_SPEC_V2.md)
- **キャッシュ実装**: [docs/CACHE_IMPLEMENTATION.md](../docs/CACHE_IMPLEMENTATION.md)
- **Firestore Vector Search**: [docs/FIRESTORE_VECTOR_MIGRATION_REPORT.md](../docs/FIRESTORE_VECTOR_MIGRATION_REPORT.md)
- **セキュリティ**: [docs/07_SECURITY.md](../docs/07_SECURITY.md)

---

## 🔄 開発ワークフロー

### 新機能開発

1. **スコープ確認**: `docs/README.md` → 該当する仕様書
2. **設計**: アーキテクチャドキュメント確認
3. **テスト関数作成**: 実装前にテストを書く
4. **実装**: コーディング規約に従う
5. **API呼び出し回数確認**: `/check-api-calls`
6. **テスト実行**: `/test-backend` または `/test-frontend`
7. **ドキュメント更新**: `/update-docs`
8. **コミット**: 変更内容を明記

### エラー対応フロー

1. **エラー記録開始**: `docs/ERROR_LOG.md` にエントリー作成
   - 発生日時、症状、影響範囲を記録
2. **原因調査**: ログ分析、コードレビュー
3. **解決策実施**: 修正コード実装
4. **エラー記録完了**: 原因分析・解決策・再発防止策・教訓を記載
5. **コミット**: `fix: ` プレフィックスでコミット

### API呼び出し実装チェックリスト

実装前に以下を確認:

- [ ] リトライループがないこと（1回のみ実行）
- [ ] エラー時は即座に `throw`/`raise` すること
- [ ] API呼び出し前後にログ出力すること
- [ ] `docs/ERROR_LOG.md` の過去のAPI関連エラーを確認したこと

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
- [ ] `docs/ERROR_LOG.md` 更新（新規エラーがある場合）
- [ ] `/update-docs` 実行済み
- [ ] セキュリティチェック（個人情報マスキング確認）
- [ ] コミットメッセージに変更内容明記

---

## 🎯 現在のシステム状態（2025-10-28）

### ✅ 実装完了済み

- **Phase 3**: Firestore Vector Search移植（3,151件、10-15倍高速化）
- **Phase 4**: RAG Engine統合（環境変数で切替可能）
- **会話履歴コンテキスト化**: Backend + Frontend統合完了
- **SSEストリーミング問題**: 修正完了（2025-10-28）
- **API重複呼び出し問題**: 修正完了（ClientsContext導入）

### 🔄 次のステップ（優先度順）

1. **Firestore Vector Search本番切替** - 環境変数設定のみ（10-15倍高速化）
2. **Firebase認証実装** - 設計完了、実装ガイドあり（1週間）
3. **LangSmith監視実装** - 設計完了、統合ガイドあり（1週間）

### 📊 パフォーマンス

- **検索速度**: 約45秒（Spreadsheet）→ 3-5秒に短縮可能（Firestore）
- **キャッシュ効果**: API呼び出し67.5%削減、コスト76.1%削減
- **検索精度**: NDCG@10 = 0.85（ハイブリッド検索 + Reranking）

---

## 📚 関連リソース

### 公式ドキュメント

- [Vertex AI Generative AI](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Firestore Vector Search](https://firebase.google.com/docs/firestore/vector-search)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js 14 Documentation](https://nextjs.org/docs)

### 内部ドキュメント

- **全体構成**: [docs/README.md](../docs/README.md)
- **過去のエラー**: [docs/ERROR_LOG.md](../docs/ERROR_LOG.md) ⭐ **必読**
- **アーキテクチャ分析**: [docs/RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md](../docs/RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md)

---

**最終更新**: 2025-10-28
**ドキュメント最適化**: 36個 → 23個（2025-10-28）
**次回レビュー**: 毎週月曜日
