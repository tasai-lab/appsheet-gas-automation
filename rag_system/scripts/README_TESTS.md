# RAG医療アシスタント - テストスクリプト実行ガイド

このディレクトリには、RAG医療アシスタントシステムの検証・テスト用スクリプトが含まれています。

## 📋 テストスクリプト一覧

| Phase | スクリプト | 目的 | 実行タイミング |
|-------|-----------|------|--------------|
| 4.3x-9/10 | `validate_vectorization.py` | ベクトル化検証（source_id/client_id、データ整合性） | ベクトル化完了後 |
| 5.1 | `e2e_integration_test.py` | エンドツーエンド統合テスト（検索・チャット・フィルタリング） | データ検証合格後 |
| 5.2 | `accuracy_evaluation.py` | 精度評価（NDCG@10、QA精度） | 統合テスト合格後 |
| 5.3 | `performance_test.py` | パフォーマンステスト（レイテンシ、スループット） | 精度評価合格後 |

---

## 🚀 実行手順

### 前提条件

1. **ベクトル化完了**:
   ```bash
   # ベクトル化スクリプトが完了していることを確認
   # 進捗確認: vectorization_fixed.log を参照
   ```

2. **Backend/Frontend起動**:
   ```bash
   # Backend起動（ポート8000）
   cd rag_system/backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

   # Frontend起動（ポート3000）
   cd rag_system/frontend && npm run dev
   ```

---

### Phase 4.3x-9/10: ベクトル化検証

**実行コマンド:**
```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system
python3 scripts/validate_vectorization.py
```

**検証内容:**
- ✅ source_id/user_id フィールドが正しく挿入されているか
- ✅ KnowledgeBase と Embeddings のレコード数が一致しているか
- ✅ データソース別のレコード数統計

**合格基準:**
- source_id/user_id 有効率 >= 95%
- データ整合性: KnowledgeBase ≈ Embeddings（差分 <= 5件）

---

### Phase 5.1: エンドツーエンド統合テスト

**実行コマンド:**
```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system
python3 scripts/e2e_integration_test.py
```

**テスト内容:**
1. ヘルスチェック
2. 利用者一覧取得
3. フィルタなし検索
4. フィルタあり検索（利用者指定）
5. コンテキストなしチャット
6. コンテキストありチャット（RAG）
7. レスポンスタイム測定

**合格基準:**
- 全テスト合格（失敗 = 0）
- レスポンスタイム < 3秒

---

### Phase 5.2: 精度評価

**実行コマンド:**
```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system
python3 scripts/accuracy_evaluation.py
```

**評価内容:**
- **NDCG@10**: 検索精度評価
  - テストクエリ: 訪問看護計画、利用者基本情報、通話記録要約など
  - 期待キーワード・ソースタイプとの一致度
- **QA精度**: 質疑応答精度評価
  - 回答内容にキーワードが含まれているか

**合格基準:**
- NDCG@10 >= 0.6
- QA精度 >= 0.5
- 総合スコア >= 0.7

---

### Phase 5.3: パフォーマンステスト

**実行コマンド:**
```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system
python3 scripts/performance_test.py
```

**測定内容:**
- **レイテンシ測定**:
  - 最小/最大/平均/中央値/P95
- **スループット測定**:
  - 並行リクエスト数: 5
  - 測定時間: 10秒
  - 成功率、スループット（req/s）
- **ストレステスト**:
  - 並行数: 1, 5, 10, 15, 20
  - 最適並行数の推定

**合格基準:**
- 平均レイテンシ < 1000ms
- スループット >= 5 req/s
- 成功率 >= 99%

---

## 📊 実行結果の確認

各スクリプトは実行結果を標準出力に表示します。最終行に以下のいずれかが表示されます：

- ✅ `Phase X.X: 〇〇合格！` → 次のPhaseへ進めます
- ⚠️ `Phase X.X: 改善を推奨` → 推奨レベルの改善が必要
- ❌ `Phase X.X: 不合格` → 問題を修正してください

---

## 🔄 全テスト実行スクリプト（オプション）

全テストを一括実行する場合:

```bash
#!/bin/bash
# run_all_tests.sh

cd /Users/t.asai/code/appsheet-gas-automation/rag_system

echo "========================================"
echo "Phase 4.3x-9/10: ベクトル化検証"
echo "========================================"
python3 scripts/validate_vectorization.py || exit 1

echo ""
echo "========================================"
echo "Phase 5.1: エンドツーエンド統合テスト"
echo "========================================"
python3 scripts/e2e_integration_test.py || exit 1

echo ""
echo "========================================"
echo "Phase 5.2: 精度評価"
echo "========================================"
python3 scripts/accuracy_evaluation.py || exit 1

echo ""
echo "========================================"
echo "Phase 5.3: パフォーマンステスト"
echo "========================================"
python3 scripts/performance_test.py || exit 1

echo ""
echo "🎉 全テスト完了！Phase 4.4（Vercelデプロイ）へ進めます"
```

**実行:**
```bash
chmod +x scripts/run_all_tests.sh
./scripts/run_all_tests.sh
```

---

## ⚠️ トラブルシューティング

### 1. Backend接続エラー

```
❌ 検索失敗: Connection refused
```

**解決策:**
```bash
# Backend起動確認
curl http://localhost:8000/health

# 起動していない場合
cd rag_system/backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. ベクトル化データなし

```
⚠️ KnowledgeBaseが空です
```

**解決策:**
```bash
# ベクトル化実行
cd rag_system && python3 scripts/vectorize_existing_data.py --all --batch-size 30
```

### 3. 精度評価でキーワード不一致

```
⚠️ 改善余地あり（精度 < 0.5）
```

**解決策:**
- プロンプト調整（backend/app/services/chat_service.py）
- ベクトル化データの品質確認
- 検索アルゴリズムのチューニング

---

## 📝 ログファイル

テスト実行時のログは以下に保存されます：

- `vectorization_fixed.log`: ベクトル化ログ
- 各テストスクリプトの標準出力: ターミナルで確認

---

## 🔗 関連ドキュメント

- [RAG_SYSTEM_ARCHITECTURE.md](../docs/RAG_SYSTEM_ARCHITECTURE.md): システム全体のアーキテクチャ
- [PHASE_PROGRESS_2025-10-27.md](../docs/PHASE_PROGRESS_2025-10-27.md): フェーズ進捗管理
- [CLAUDE.md](../.claude/CLAUDE.md): プロジェクト全体の開発ガイド
