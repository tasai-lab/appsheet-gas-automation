# 計画と実装の整合性チェック

ドキュメントに記載された計画と実装コードの整合性を検証する。

## チェック項目

### 1. Embeddingモデル名

**計画**: `gemini-embedding-001` (3072次元)

**チェック対象**:
- `backend/app/config.py`: `vertex_ai_embeddings_model`
- `common_modules/embeddings_service.gs`: `EMBEDDINGS_CONFIG.model`
- `docs/*.md`: モデル名記載

**検証コマンド**:
```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system

# Backend設定確認
grep -n "vertex_ai_embeddings_model" backend/app/config.py

# GAS共通モジュール確認
grep -n "model:" ../common_modules/embeddings_service.gs

# ドキュメント全検索
grep -r "gemini-embedding-001\|text-embedding-004\|text-embedding-005" docs/
```

**期待結果**:
- ✅ 全ファイルで `gemini-embedding-001` を使用
- ❌ `text-embedding-004` や `text-embedding-005` が見つかる → 修正必要

### 2. Embedding次元数

**計画**: 3072次元

**チェック対象**:
- `backend/app/config.py`: `vertex_ai_embeddings_dimension`
- `common_modules/embeddings_service.gs`: `outputDimensionality`
- ドキュメント記載

**検証コマンド**:
```bash
# 次元数確認
grep -rn "3072\|768\|1536" backend/app/config.py common_modules/embeddings_service.gs docs/
```

**期待結果**:
- ✅ 全て `3072` に統一
- ❌ `768` や `1536` が見つかる → 修正必要

### 3. GCPプロジェクトID

**計画**: `fractal-ecosystem`

**チェック対象**:
- `backend/app/config.py`
- `backend/.env.example`
- `docs/02_ARCHITECTURE.md`
- `common_modules/*.gs`

**検証コマンド**:
```bash
# プロジェクトID確認
grep -rn "fractal-ecosystem\|macro-shadow" backend/ docs/ ../common_modules/
```

**期待結果**:
- ✅ 全て `fractal-ecosystem`
- ❌ `macro-shadow-458705-v8` が見つかる → 古いID、修正必要

### 4. Re-rankingモデル

**計画**: Vertex AI Ranking API (`semantic-ranker-default-004`)

**チェック対象**:
- `backend/app/config.py`: `reranker_type`, `reranker_model`
- `backend/.env.example`
- `docs/03_HYBRID_SEARCH_SPEC_V2.md`

**検証コマンド**:
```bash
# Rerankerモデル確認
grep -rn "cross-encoder\|semantic-ranker\|vertex_ai_ranking_api" backend/ docs/
```

**期待結果**:
- ✅ `vertex_ai_ranking_api` + `semantic-ranker-default-004`
- ❌ `cross-encoder` が見つかる → 廃止済み、削除必要

### 5. APIポート番号

**計画**: Backend内部8000、パブリック8080

**チェック対象**:
- `backend/app/config.py`: `port`
- `frontend/src/lib/api.ts`: `API_URL` デフォルト値

**検証コマンド**:
```bash
# ポート設定確認
grep -n "8000\|8080" backend/app/config.py frontend/src/lib/api.ts
```

**期待結果**:
- ✅ Backend内部: 8000
- ✅ Frontend API URL: 8080 (パブリックアクセス)

### 6. ドキュメントリンク

**計画**: 全ドキュメント相互リンク

**チェック対象**:
- `README.md`: ドキュメントリンク
- `docs/01_PROJECT_OVERVIEW.md`: 参照リンク

**検証コマンド**:
```bash
# リンク切れ確認
cd docs
grep -rn "\[.*\](.*\.md)" *.md | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  link=$(echo "$line" | sed -n 's/.*(\(.*\.md\)).*/\1/p')
  if [ ! -f "$link" ]; then
    echo "❌ リンク切れ: $file -> $link"
  fi
done
```

## 自動整合性チェックスクリプト

```bash
#!/bin/bash

cd /Users/t.asai/code/appsheet-gas-automation/rag_system

echo "=== RAGシステム整合性チェック ==="
echo ""

# 1. Embeddingモデル名
echo "1. Embeddingモデル名チェック..."
if grep -q "gemini-embedding-001" backend/app/config.py && \
   ! grep -q "text-embedding-004\|text-embedding-005" backend/app/config.py; then
  echo "✅ Backend: gemini-embedding-001"
else
  echo "❌ Backend: 不正なモデル名検出"
fi

# 2. Embedding次元数
echo "2. Embedding次元数チェック..."
if grep -q "vertex_ai_embeddings_dimension.*3072" backend/app/config.py; then
  echo "✅ Backend: 3072次元"
else
  echo "❌ Backend: 次元数不一致"
fi

# 3. GCPプロジェクトID
echo "3. GCPプロジェクトID チェック..."
if grep -q "fractal-ecosystem" backend/app/config.py backend/.env.example && \
   ! grep -q "macro-shadow" backend/app/config.py docs/02_ARCHITECTURE.md; then
  echo "✅ GCPプロジェクト: fractal-ecosystem"
else
  echo "❌ GCPプロジェクト: 古いID検出"
fi

# 4. Re-rankingモデル
echo "4. Re-rankingモデル チェック..."
if grep -q "vertex_ai_ranking_api" backend/app/config.py && \
   ! grep -q "cross-encoder" backend/app/config.py backend/.env.example; then
  echo "✅ Reranker: Vertex AI Ranking API"
else
  echo "❌ Reranker: 廃止モデル検出"
fi

echo ""
echo "=== チェック完了 ==="
```

## 整合性レポート生成

過去の整合性チェック結果を参照:

- [CONSISTENCY_CHECK_REPORT.md](/Users/t.asai/code/appsheet-gas-automation/rag_system/docs/CONSISTENCY_CHECK_REPORT.md) (初回チェック)
- [CONSISTENCY_FIX_SUMMARY.md](/Users/t.asai/code/appsheet-gas-automation/rag_system/docs/CONSISTENCY_FIX_SUMMARY.md) (修正完了報告)
- [CONSISTENCY_VERIFICATION_2025-10-27.md](/Users/t.asai/code/appsheet-gas-automation/rag_system/docs/CONSISTENCY_VERIFICATION_2025-10-27.md) (最新検証)

## 不整合発見時のアクション

1. **ERROR_LOG.md に記録**
2. **該当ファイルを修正**
3. **コミット**
4. **再検証**
5. **整合性レポート更新**

---

**最終更新**: 2025-10-27
