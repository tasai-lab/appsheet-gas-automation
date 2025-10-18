# AppSheet-GAS 自動化プラットフォーム - ドキュメントセンター

**最終更新**: 2025-10-18

---

## 📚 ドキュメント構成

### 🏗️ [architecture/](./architecture/) - アーキテクチャ設計

システム全体の設計思想、技術選定、構成図などを管理します。

**予定コンテンツ**:
- システムアーキテクチャ概要
- データフロー図
- API設計仕様
- インフラ構成図

---

### 👨‍💻 [development/](./development/) - 開発ガイド

開発者向けの実践的なガイドを提供します。

**予定コンテンツ**:
- 開発環境セットアップ
- コーディング規約
- デバッグ手法
- テスト戦略
- デプロイ手順

---

### 🔄 [migration/](./migration/) - 移行ガイド

重要なシステム移行の記録とガイドを管理します。

**現在のドキュメント**:
- [GEMINI_API_ABOLITION.md](./migration/GEMINI_API_ABOLITION.md) - Google AI Studio API完全廃止ガイド
  - 全18プロジェクトのVertex AI移行記録
  - API呼び出し削減: -99.95%
  - セキュリティ強化の詳細

---

### 🔐 [security/](./security/) - セキュリティ関連

セキュリティ監査、脆弱性対応、セキュリティポリシーを管理します。

**現在のドキュメント**:
- [API_CALL_SECURITY_AUDIT.md](./security/API_CALL_SECURITY_AUDIT.md) - API呼び出しセキュリティ監査
- [API_CALL_AUDIT_REPORT.md](./security/API_CALL_AUDIT_REPORT.md) - 全プロジェクト監査レポート

**重要な成果**:
- リトライループの完全削除
- APIキー認証の完全廃止
- サービスアカウント権限の最小化

---

### 📖 [api-reference/](./api-reference/) - API リファレンス

使用しているAPIの仕様、サンプルコード、ベストプラクティスを提供します。

**予定コンテンツ**:
- Vertex AI API使用ガイド
- AppSheet API仕様
- Google Workspace API連携方法
- 共通モジュールAPI

---

## 🎯 クイックリンク

### 最重要ドキュメント

1. **[Vertex AI 移行ガイド](./migration/GEMINI_API_ABOLITION.md)**
   - 🔴 **必読** - すべての開発者が理解すべき内容
   - Google AI Studio API禁止ルール
   - Vertex AI専用実装パターン

2. **[セキュリティ監査レポート](./security/API_CALL_SECURITY_AUDIT.md)**
   - API呼び出しの安全性確認
   - リトライループ対策

### プロジェクト別ドキュメント

- [訪問看護プロジェクト](../projects/nursing/README.md)
- [営業プロジェクト](../projects/sales/)
- [通話プロジェクト](../projects/calls/)
- [クライアント管理プロジェクト](../projects/clients/)
- [共通機能プロジェクト](../projects/common/)
- [自動化プロジェクト](../projects/automation/)

---

## 📊 ドキュメント統計

| カテゴリ | ドキュメント数 | 状態 |
|---------|--------------|------|
| Migration | 1 | ✅ Complete |
| Security | 2 | ✅ Complete |
| Architecture | 0 | 📝 Planned |
| Development | 0 | 📝 Planned |
| API Reference | 0 | 📝 Planned |

---

## 🔄 ドキュメント更新ポリシー

### 更新タイミング

1. **コード変更時** - 関連ドキュメントを同時更新
2. **セキュリティ変更時** - 即座にドキュメント更新
3. **API変更時** - 移行ガイド・APIリファレンスを更新
4. **月次** - 全体レビューと更新

### バージョン管理

すべてのドキュメントに以下を記載:
- 最終更新日
- 変更履歴（重要な変更）
- レビュー担当者

---

## 📝 ドキュメント作成ガイドライン

### 必須要素

- 📋 **概要** - 目的と対象読者
- 🎯 **前提条件** - 必要な知識・環境
- 🚀 **手順** - 具体的なステップ
- ⚠️ **注意事項** - 重要な警告
- 🔗 **関連リンク** - 参考資料

### 推奨フォーマット

```markdown
# タイトル

**作成日**: YYYY-MM-DD
**最終更新**: YYYY-MM-DD
**対象読者**: 開発者 / 運用担当 / 管理者

## 概要
...

## 前提条件
...

## 詳細
...

## トラブルシューティング
...

## 関連ドキュメント
...
```

---

## 🤝 貢献

ドキュメントの改善提案は歓迎します:

1. 誤字・脱字の修正
2. 不明瞭な説明の改善
3. サンプルコードの追加
4. 新しいガイドの作成

**連絡先**: t.asai@fractal-group.co.jp

---

**メンテナ**: Fractal Group 開発チーム
**ライセンス**: © 2025 Fractal Group. All rights reserved.
