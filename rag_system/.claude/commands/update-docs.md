# ドキュメント更新

## 目的

実装変更に伴うドキュメントの更新を行う

## 実行内容

1. 変更内容の確認
2. 該当するドキュメントの特定
3. Mermaid図の更新（必要に応じて）
4. バージョン情報更新

## 手順

### 1. 変更内容確認

```bash
# 最近の変更を確認
git diff --name-only HEAD~1

# 変更されたファイル一覧
git status
```

### 2. 更新対象ドキュメント

| 変更内容 | 更新対象ドキュメント |
|---------|-------------------|
| APIエンドポイント変更 | `docs/04_API_SPECIFICATION.md` |
| データモデル変更 | `docs/05_DATA_MODEL.md` (未作成の場合は作成) |
| アーキテクチャ変更 | `docs/02_ARCHITECTURE.md` |
| Hybrid Search変更 | `docs/03_HYBRID_SEARCH_SPEC.md` |
| セキュリティ変更 | `docs/07_SECURITY.md` |
| デプロイ手順変更 | `docs/06_DEPLOYMENT.md` |
| エラー発生 | `docs/ERROR_LOG.md` |

### 3. Mermaid図の更新

**ダークモード対応カラー使用:**

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor':'#4A90E2','secondaryColor':'#7B68EE','tertiaryColor':'#50C878'}}}%%
```

**カラーパレット:**
- Primary (青): `#4A90E2`
- Secondary (紫): `#7B68EE`
- Success (緑): `#50C878`
- Error (赤): `#E74C3C`
- Warning (黄): `#F39C12`

### 4. バージョン更新

各ドキュメント最下部の更新日時を変更:

```markdown
---

**最終更新**: 2025-10-27
**バージョン**: 1.0.1
```

### 5. README.md更新

プロジェクトルートの `README.md` も必要に応じて更新:

- 機能追加
- 変更履歴
- マイルストーン進捗

## チェックリスト

- [ ] 変更内容を確認
- [ ] 該当ドキュメント特定
- [ ] ドキュメント内容更新
- [ ] Mermaid図更新（必要時）
- [ ] コードサンプル更新（必要時）
- [ ] バージョン情報更新
- [ ] README.md更新（必要時）
- [ ] リンク切れ確認
- [ ] コミット

---

**最終更新**: 2025-10-27
