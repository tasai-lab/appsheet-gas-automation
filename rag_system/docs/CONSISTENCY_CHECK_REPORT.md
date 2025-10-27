# プロジェクト整合性チェックレポート

> **実施日**: 2025-10-27
> **チェック担当**: Claude Code
> **ステータス**: ⚠️ 重大な不整合を検出

---

## ❌ 発見された不整合

### 1. GCPプロジェクトID の不整合 (重大度: 🔴 高)

| ファイル | 記載内容 | 正解 | 修正要否 |
|---------|---------|------|---------|
| `docs/02_ARCHITECTURE.md` (154行目) | `macro-shadow-458705-v8` | `fractal-ecosystem` | ✅ 要修正 |
| `docs/02_ARCHITECTURE.md` (149行目) | `macro-shadow-458705-v8` | `fractal-ecosystem` | ✅ 要修正 |
| `docs/GCP_SETUP.md` | `fractal-ecosystem` | `fractal-ecosystem` | ✅ 正しい |
| `backend/.env.example` | `fractal-ecosystem` | `fractal-ecosystem` | ✅ 正しい |
| `frontend/.env.local.example` | `fractal-ecosystem` | `fractal-ecosystem` | ✅ 正しい |
| `common_modules/embeddings_service.gs` | `fractal-ecosystem` | `fractal-ecosystem` | ✅ 正しい |

**影響範囲:**
- Backend実装時に誤ったプロジェクトIDを参照する可能性
- API呼び出しが失敗する

---

### 2. Hybrid Search段階数の不整合 (重大度: 🟡 中)

| ファイル | 記載内容 | 正解 | 修正要否 |
|---------|---------|------|---------|
| `README.md` (11行目) | "3段階Hybrid Search" | "5段階Hybrid Search" | ✅ 要修正 |
| `docs/02_ARCHITECTURE.md` (127行目) | "3段階Hybrid Search" | "5段階Hybrid Search" | ✅ 要修正 |
| `docs/03_HYBRID_SEARCH_SPEC_V2.md` | "5段階Hybrid Search" | "5段階Hybrid Search" | ✅ 正しい |

**正しいアーキテクチャ:**
1. Stage 0: Query Preprocessing (医療用語展開、HyDE/Multi-Query)
2. Stage 1: BM25 Keyword Search
3. Stage 2: Dense Vector Retrieval
4. Stage 3: RRF Fusion (k=60)
5. Stage 4: Gemini Flash-Lite Re-ranking
6. Stage 5: Validation & Term Suggestion

**影響範囲:**
- ドキュメント間の矛盾
- 開発者の誤解を招く

---

### 3. Re-rankingモデルの不整合 (重大度: 🔴 高)

| ファイル | 記載内容 | 正解 | 修正要否 |
|---------|---------|------|---------|
| `README.md` (11行目) | "Cross-Encoder Reranking" | "Gemini Flash-Lite Re-ranking" | ✅ 要修正 |
| `docs/02_ARCHITECTURE.md` (164行目) | "Cross-Encoder" | "Gemini Flash-Lite" | ✅ 要修正 |
| `backend/.env.example` (15行目) | `RERANKER_MODEL=cross-encoder/...` | Gemini使用（環境変数不要） | ✅ 要修正 |
| `docs/03_HYBRID_SEARCH_SPEC_V2.md` | "Gemini Flash-Lite Re-ranking" | "Gemini Flash-Lite Re-ranking" | ✅ 正しい |

**技術的決定事項 (REF_INTEGRATION_REPORT.md より):**
- Cross-Encoder (Cloud Run + GPU): ~$5/月 → ❌ 廃止
- **Gemini 2.5 Flash-Lite**: ~$0.40/月 → ✅ 採用
- コスト削減率: **92%**

**影響範囲:**
- Backend実装時に廃止された技術を使用する可能性
- 不要なライブラリ依存関係の追加

---

### 4. Embedding次元数のコメント不整合 (重大度: 🟡 中)

| ファイル | 記載内容 | 正解 | 修正要否 |
|---------|---------|------|---------|
| `common_modules/embeddings_service.gs` (9行目) | コメント "768次元" | "3072次元" | ✅ 要修正 |
| `common_modules/embeddings_service.gs` (18行目) | コメント "// 768" | "// 3072" | ✅ 要修正 |
| `common_modules/embeddings_service.gs` (49行目) | コメント "768次元" | "3072次元" | ✅ 要修正 |
| `common_modules/embeddings_service.gs` (37行目) | 実装 `outputDimensionality: 3072` | `3072` | ✅ 正しい |

**実際の実装:**
```javascript
const EMBEDDINGS_CONFIG = {
  outputDimensionality: 3072,  // ✅ 正しい
  // ...
};
```

**影響範囲:**
- 開発者がコメントを信じて誤った想定をする
- ドキュメントとコードの不一致

---

### 5. コスト試算の不整合 (重大度: 🟡 中)

| ファイル | 記載内容 | 正解 | 修正要否 |
|---------|---------|------|---------|
| `README.md` (139行目) | 月額約$24 (1,000検索/月) | 月額$0.40 (500クエリ/月) | ✅ 要修正 |
| `docs/03_HYBRID_SEARCH_SPEC_V2.md` | 月額$0.40 (500クエリ/月) | 月額$0.40 (500クエリ/月) | ✅ 正しい |
| `docs/REF_INTEGRATION_REPORT.md` | 月額$0.40 (500クエリ/月) | 月額$0.40 (500クエリ/月) | ✅ 正しい |

**正しいコスト試算 (Gemini Flash-Lite使用):**
```
Phase 1: $0.40/月 (500クエリ)
- Embedding生成: $0.00 (無料)
- Gemini Flash-Lite Re-ranking: $0.40
- Vector Search: $0.0005

Phase 2 (Context Caching適用後): $0.10/月 (75%削減)
```

**影響範囲:**
- 予算承認時の誤算
- プロジェクトオーナーへの誤報告

---

### 6. ファイル参照の不整合 (重大度: 🟢 低)

| ファイル | 参照パス | 実際の状態 | 修正要否 |
|---------|---------|-----------|---------|
| `README.md` (157行目) | `docs/03_HYBRID_SEARCH_SPEC.md` | `docs/03_HYBRID_SEARCH_SPEC_V2.md` | ✅ 要修正 |
| `README.md` (159行目) | `docs/05_DATA_MODEL.md` | ❌ 存在しない | ✅ 削除 or 作成 |
| `docs/01_PROJECT_OVERVIEW.md` | `05_DATA_MODEL.md` | ❌ 存在しない | ✅ 削除 or 作成 |

**影響範囲:**
- ドキュメントリンク切れ
- ユーザーの混乱

---

### 7. Geminiモデル指定の不整合 (重大度: 🟡 中)

| ファイル | 記載内容 | 推奨設定 | 修正要否 |
|---------|---------|---------|---------|
| `backend/.env.example` (10行目) | `GEMINI_MODEL=gemini-2.5-flash` | `gemini-2.5-flash-lite` | ⚠️ 検討要 |
| `backend/.env.example` (11行目) | `GEMINI_PRO_MODEL=gemini-2.5-pro` | - | ✅ OK |

**注意:**
- Re-ranking: Flash-Lite推奨 (コスト最適)
- 回答生成: Flash or Flash-Lite (用途による)
- 複雑な推論: Pro (必要時のみ)

**影響範囲:**
- コスト超過の可能性
- 不必要に高性能モデルを使用

---

## ✅ 整合性が取れている項目

### 1. GCPプロジェクト設定
- ✅ `fractal-ecosystem` が正しく設定されている箇所が多数
- ✅ プロジェクト番号 `411046620715` 一致
- ✅ リージョン `us-central1` 一致

### 2. Embedding仕様
- ✅ 実装: 3072次元 (正しい)
- ✅ モデル: gemini-embedding-001 (正しい)
- ✅ タスクタイプ: RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY (正しい)

### 3. 最新仕様書
- ✅ `docs/03_HYBRID_SEARCH_SPEC_V2.md`: Flash-Lite統合済み
- ✅ `docs/REF_INTEGRATION_REPORT.md`: コスト計算正確
- ✅ `docs/GCP_SETUP.md`: プロジェクト情報正確

---

## 📋 修正推奨順位

### 🔴 優先度: 高 (即時修正必須)

1. **02_ARCHITECTURE.md のGCPプロジェクトID修正**
   - `macro-shadow-458705-v8` → `fractal-ecosystem`
   - 149行目、154行目の2箇所

2. **backend/.env.example のReranker設定削除**
   - `RERANKER_MODEL=cross-encoder/...` 行を削除
   - コメント追加: `# Re-ranking: Gemini Flash-Lite使用 (GEMINI_MODELで指定)`

3. **README.md のHybrid Search説明修正**
   - "3段階" → "5段階"
   - "Cross-Encoder" → "Gemini Flash-Lite"

### 🟡 優先度: 中 (1週間以内)

4. **README.md のコスト試算更新**
   - 月額$24 → $0.40/月 (500クエリ)
   - コスト内訳を最新版に更新

5. **common_modules/embeddings_service.gs のコメント修正**
   - 全ての "768次元" コメント → "3072次元"

6. **02_ARCHITECTURE.md のアーキテクチャ説明更新**
   - "3段階Hybrid Search" → "5段階Hybrid Search"
   - Cross-Encoder言及を削除
   - Gemini Flash-Lite Re-rankingを追加

### 🟢 優先度: 低 (時間があるとき)

7. **README.md のファイル参照修正**
   - `03_HYBRID_SEARCH_SPEC.md` → `03_HYBRID_SEARCH_SPEC_V2.md`

8. **05_DATA_MODEL.md の作成 or 参照削除**
   - 作成する場合: Vector DB スキーマ定義を記載
   - 削除する場合: README.md、01_PROJECT_OVERVIEW.md から参照削除

9. **backend/.env.example のGEMINI_MODEL検討**
   - Re-ranking用途では Flash-Lite推奨
   - 用途別コメント追加

---

## 🎯 修正後の期待状態

### ドキュメント整合性
- [ ] 全ドキュメントで `fractal-ecosystem` 使用
- [ ] 全ドキュメントで "5段階Hybrid Search" 記載
- [ ] 全ドキュメントで "Gemini Flash-Lite Re-ranking" 記載
- [ ] 全ドキュメントでコスト試算が $0.40/月

### 実装整合性
- [ ] backend/.env.example から Cross-Encoder 設定削除
- [ ] common_modules/embeddings_service.gs のコメントが 3072次元
- [ ] 全ファイル参照がリンク切れなし

### 技術スタック整合性
- [ ] Re-ranking: Gemini Flash-Lite のみ
- [ ] Embedding: 3072次元 のみ
- [ ] GCPプロジェクト: fractal-ecosystem のみ

---

## 📊 整合性スコア

| カテゴリ | スコア | 評価 |
|---------|-------|------|
| **GCP設定** | 70% | ⚠️ 一部ドキュメントで古いProject ID |
| **アーキテクチャ** | 65% | ⚠️ Hybrid Search段階数とRe-ranking手法が不統一 |
| **コスト試算** | 75% | ⚠️ READMEが古いコスト情報 |
| **実装コード** | 90% | ✅ 実装は概ね正しい、コメントのみ修正要 |
| **環境設定** | 80% | ⚠️ backend/.env.exampleに廃止技術の記載 |
| **ファイル参照** | 85% | ⚠️ 一部リンク切れ |

**総合スコア**: 77% (⚠️ 修正推奨)

---

## 🔧 次のアクション

### 即時対応 (今日)
1. ✅ 整合性チェック完了 (本レポート)
2. ⏳ 02_ARCHITECTURE.md のGCPプロジェクトID修正
3. ⏳ README.md のHybrid Search説明修正
4. ⏳ backend/.env.example のReranker設定修正

### 短期対応 (今週)
5. ⏳ common_modules/embeddings_service.gs コメント修正
6. ⏳ README.md コスト試算更新
7. ⏳ ファイル参照修正

### 検討事項
- 05_DATA_MODEL.md を作成するか？
  - **推奨**: 作成（Vector DB スキーマ定義を明記）
  - **代替**: 02_ARCHITECTURE.md に統合し、参照削除

---

**承認**:
- [ ] 技術リード確認
- [ ] プロジェクトマネージャー確認

**文書管理**:
- バージョン: 1.0
- 作成日: 2025-10-27
- 次回チェック: 修正完了後
