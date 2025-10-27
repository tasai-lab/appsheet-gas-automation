# clasp push 問題のトラブルシューティングガイド

**作成日**: 2025-10-21
**更新日**: 2025-10-21 (Web調査結果を追加)
**ステータス**: 根本原因を特定
**影響範囲**: clasp create で新規作成したプロジェクト

## 🚨 なぜ自動で行えないのか？

### 根本原因（Web調査で確認）

**clasp createコマンドの実装にバグがある**

1. **プロジェクト作成時の内部状態の初期化が不完全**
   - ファイル同期状態の追跡メカニズムが正しく設定されない
   - ローカルとリモートの同期マップが作成されない

2. **既知のGitHub Issues**
   - [Issue #669](https://github.com/google/clasp/issues/669): Files ignored on push directly after clone
   - [Issue #507](https://github.com/google/clasp/issues/507): Clasp push does not update remote code
   - [Issue #255](https://github.com/google/clasp/issues/255): Clasp push fails silently

3. **Stack Overflowでの多数の報告**
   - 同じ問題が2018年から継続的に報告されている
   - Google公式の解決策は提示されていない

## 問題の概要

`clasp create` で新規作成したGASプロジェクトで `clasp push` を実行すると、以下のエラーが発生する：

1. **Skipping push**: 変更が検出されない
2. **Invalid ID**: `clasp push --force` 実行時にscriptIdが認識されない

## 調査結果

### 発生条件

- ✅ **clasp alpha版（3.0.6-alpha）**: 問題発生
- ✅ **clasp安定版（3.1.0）**: 同じ問題が発生
- ✅ **clasp create で新規作成**: 問題発生
- ✅ **clasp pull実行後も**: 問題継続
- ✅ **.claspignore作成後も**: 問題継続
- ✅ **clasp push -w (watch mode)**: 同様に失敗
- ❌ **clasp clone で既存プロジェクト**: 問題なし
- ❌ **GASエディタで作成 → clasp clone**: 正常動作

### 問題の原因

**`clasp create` で作成されたプロジェクトの初期化に問題がある**

具体的には：
1. `clasp create` 直後のプロジェクトでは、claspの内部状態が正しく初期化されていない
2. ファイル同期マップ（どのファイルがリモートと同期されているか）が作成されない
3. `clasp status` ではファイルがTrackedと表示されるが、実際にはpushされない
4. 新しいファイルを追加しても、タイムスタンプを更新しても、Skipping pushが続く
5. `--force` オプションを使うと "Invalid ID" エラーが発生

### 検証結果

| 操作 | 結果 |
|------|------|
| clasp create → clasp push | ❌ Skipping push |
| clasp create → clasp push --force | ❌ Invalid ID |
| clasp create → ファイル追加 → clasp push | ❌ Skipping push |
| clasp create → タイムスタンプ更新 → clasp push | ❌ Skipping push |
| clasp create → clasp pull → clasp push | ❌ Skipping push |
| clasp create → .claspignore作成 → clasp push | ❌ Skipping push |
| clasp create → clasp push -w (watch mode) | ❌ Skipping push |
| 既存プロジェクト → clasp push --force | ✅ 成功 |
| GASエディタで作成 → clasp clone → push | ✅ 成功 |

## 🛠️ clasp の自動化機能（理論上）

claspには以下の自動化機能があります：

### 1. Watch Mode

```bash
clasp push -w
```

ファイル保存時に自動的にpushします。

**しかし**: clasp createの初期化問題により、この機能も動作しません。

### 2. Git Hook連携

`.git/hooks/pre-push` に以下を追加：

```bash
#!/bin/sh
clasp push
```

Git pushと連動してclasp pushを自動実行します。

**しかし**: これもclasp createの問題の影響を受けます。

## 解決策

### 推奨される回避策

#### 方法1: GASエディタで作成 + clasp clone（最も確実）

1. **GASエディタでプロジェクトを作成**
   ```
   https://script.google.com/home
   ```
   - 「新しいプロジェクト」をクリック
   - プロジェクト名を設定
   - scriptIdをコピー（URLの `/d/` と `/edit` の間）

2. **clasp clone で既存プロジェクトをクローン**
   ```bash
   cd your-project-directory
   clasp clone SCRIPT_ID --rootDir ./scripts
   ```

3. **ファイルを編集してpush**
   ```bash
   # ファイル編集
   vi scripts/main.gs

   # pushが正常に動作
   clasp push
   ```

**なぜこの方法が動作するのか**: GASエディタ側で正しく初期化されたプロジェクトをcloneするため、ファイル同期状態が正しく設定される。

#### 方法2: 既存プロジェクトのコピー

1. **動作しているプロジェクトの .clasp.json をコピー**
   ```json
   {
     "rootDir": "./scripts",
     "scriptId": "YOUR_SCRIPT_ID"
   }
   ```

2. **clasp clone** して初期化
   ```bash
   clasp pull
   ```

3. **ファイルを編集してpush**
   ```bash
   clasp push
   ```

#### 方法3: GASエディタで直接編集（最終手段）

clasp pushが動作しない場合は、GASエディタで直接ファイルを編集：

1. GASエディタを開く
2. ローカルファイルの内容をコピペ
3. 保存してデプロイ

### 今後の新規プロジェクト作成手順

```bash
# ❌ 使用しない: clasp create
# clasp create --type standalone --title "Project Name"

# ✅ 推奨方法1: GASエディタで作成 → clasp clone
# 1. GASエディタで新規プロジェクト作成
# 2. scriptIdをコピー
# 3. clasp cloneで同期
clasp clone SCRIPT_ID --rootDir ./scripts

# または

# ✅ 推奨方法2: 既存プロジェクトをテンプレートとして使用
cp -r existing_project new_project
cd new_project
# .clasp.jsonのscriptIdを更新
clasp pull  # 既存のプロジェクトと同期
# ファイルを編集
clasp push
```

## 成功事例

### 動作するプロジェクトの .clasp.json 形式

```json
{
  "rootDir": "./scripts",
  "scriptId": "1a5w4i6tO8CviYE2obxd0aCiU5BtwoNc2Ajrscedi5ceoQWa7DdlZGbP1"
}
```

**重要なポイント**:
- `rootDir` が `scriptId` の前に配置されている
- シンプルな構成（余計なキーがない）

### 動作確認済みプロジェクト

- ✅ `Appsheet_訪問看護_書類OCR` (clasp cloneで作成)
- ✅ `Appsheet_利用者_反映` (clasp cloneで作成)

## claspバージョン管理

### 現在の推奨バージョン

```bash
npm list -g @google/clasp
# @google/clasp@3.1.0 (安定版)
```

**注意**: alpha版でも安定版でも同じ問題が発生します。これはバージョンの問題ではなく、clasp createの実装上の問題です。

### alpha版からの切り替え

```bash
# alpha版をアンインストール
npm uninstall -g @google/clasp

# 安定版をインストール
npm install -g @google/clasp

# バージョン確認
clasp --version
# 3.1.0
```

## デバッグコマンド

### 問題診断

```bash
# clasp バージョン確認
clasp --version

# プロジェクト状態確認
clasp status

# .clasp.json確認
cat .clasp.json

# リモートと同期
clasp pull

# 強制プッシュ（既存プロジェクトのみ）
clasp push --force

# Watch mode (ファイル保存時に自動push)
clasp push -w
```

### ログ出力

```bash
# 詳細ログ出力
clasp push 2>&1 | tee clasp-push.log

# status確認
clasp status 2>&1 | tee clasp-status.log
```

## FAQ

### Q: なぜ clasp create は動作しないのか？

A: clasp createで作成されたプロジェクトは、内部的なファイル同期状態が正しく初期化されていない。これはclaspのバグまたは設計上の制限で、GitHub Issueでも2018年から報告され続けている既知の問題。

### Q: 既存プロジェクトでは問題ないのに、新規プロジェクトで失敗するのはなぜ？

A: 既存プロジェクトは過去にGASエディタまたは clasp clone で正しく初期化されているため、ファイル同期マップが正しく設定されている。clasp create による初期化方法には根本的な問題がある。

### Q: alpha版から安定版に切り替えれば解決する？

A: いいえ。alpha版（3.0.6-alpha）でも安定版（3.1.0）でも同じ問題が発生する。これはバージョンの問題ではなく、clasp createの仕様またはバグ。

### Q: --forceオプションでも失敗するのはなぜ？

A: clasp createで作成されたscriptIdが、claspの内部状態で正しく認識されていないため。既存プロジェクトでは --force が正常に動作する。

### Q: Watch Mode (-w) は使えないのか？

A: clasp createの問題により、Watch Modeも動作しない。正しく初期化されたプロジェクト（clasp cloneで作成）では、Watch Modeは正常に動作する。

### Q: 今後、clasp createを使うべきか？

A: **使用を推奨しない**。代わりに以下の方法を使用：
1. **GASエディタで作成 → clasp clone**（最も確実）
2. 既存プロジェクトをテンプレートとして使用

### Q: Googleはこの問題を修正する予定はあるのか？

A: 2018年から報告されているが、2025年現在も未修正。Googleの公式コメントはない。回避策を使用することを推奨。

## 参考情報

### 関連GitHub Issues

- [Issue #669](https://github.com/google/clasp/issues/669): Files ignored on push directly after clone
- [Issue #507](https://github.com/google/clasp/issues/507): Clasp push does not update remote code
- [Issue #255](https://github.com/google/clasp/issues/255): Clasp push fails silently
- [Issue #66](https://github.com/google/clasp/issues/66): clasp push hangs

### Stack Overflow

- [Not able to push files using clasp push command](https://stackoverflow.com/questions/64131007/not-able-to-push-files-using-clasp-push-command)
- [How do I create and push new files client side?](https://stackoverflow.com/questions/54428807/how-do-i-create-and-push-new-files-client-side)

### 公式ドキュメント

- [Use the command line interface with clasp](https://developers.google.com/apps-script/guides/clasp)
- [clasp GitHub Repository](https://github.com/google/clasp)
- [clasp - The Apps Script CLI](https://codelabs.developers.google.com/codelabs/clasp)

### 動作環境

- **OS**: Windows 10
- **clasp**: 3.1.0 (安定版)
- **Node.js**: v20.x
- **npm**: v10.x

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2025-10-21 | 初版作成。clasp createの問題を特定し、回避策を文書化 |
| 2025-10-21 | Web調査結果を追加。根本原因を特定、GitHub Issuesを追加、Watch Modeの説明を追加 |

---

**結論**: `clasp create` は使用せず、GASエディタでプロジェクトを作成してから `clasp clone` を使用すること。この問題は2018年から存在する既知のバグであり、現時点で修正の見込みはない。
