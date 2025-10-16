# Google Apps Script 自動化プロジェクト

> **日本語ドキュメント**: [docs/ja/README.md](docs/ja/README.md) をご覧ください

Professional automation toolkit for managing Google Apps Script (GAS) projects in Google Drive.

## Quick Links

- 📚 **[日本語ドキュメント（メイン）](docs/ja/README.md)** - プロジェクト全体の詳細
- 🤖 **[Geminiモデル仕様](docs/ja/Geminiモデル仕様.md)** - API使用ガイド
- 🔒 **[重複防止機能](docs/ja/重複防止機能.md)** - Webhook重複対策
- 📊 **[実行ログ管理](docs/ja/実行ログ管理.md)** - ログシステム
- 🚀 **[デプロイガイド](docs/ja/デプロイガイド.md)** - デプロイ手順

## プロジェクト概要

このツールキットは、AppSheet統合と自動化のための32個のGoogle Apps Scriptプロジェクトを管理します：
- 30個のAppSheet統合スクリプト
- 2個の自動化スクリプト（レシート・請求書処理）
- 一元化された実行ログ記録
- 重複リクエスト防止機能
- Gemini API最適化

## 主要機能

- 🔄 **自動GAS取得** - Google Driveから全スクリプトをダウンロード・整理
- 🛡️ **重複防止** - Webhook実行の重複を防止
- 📊 **一元化ログ** - 単一スプレッドシートで全実行を追跡
- 🤖 **Gemini API統合** - 最適化されたモデル選択と使用
- 🚀 **自動デプロイ** - デプロイとバージョン管理ツール

## クイックスタート

```bash
# 依存関係のインストール
pip install -r requirements.txt

# 全GASプロジェクトの取得
python gas_retriever.py

# スクリプトの最適化
python optimize_all_appsheet_scripts.py

# GASへのデプロイ
python deploy_all_to_gas.py
```

## ドキュメント

全てのドキュメントは `docs/ja/` 配下に日本語で管理されています：

- **README.md** - プロジェクト全体のドキュメント
- **Geminiモデル仕様.md** - Gemini API仕様
- **重複防止機能.md** - 重複防止システム
- **実行ログ管理.md** - 実行ログシステム  
- **デプロイガイド.md** - デプロイ手順

## プロジェクト構成

```
all-gas/
├── docs/ja/              # 日本語ドキュメント（メイン）
├── gas_projects/         # 取得したGASプロジェクト（32プロジェクト）
├── src/                  # 共通ライブラリ
├── ツール/                # Python自動化ツール
│   ├── gas_retriever.py
│   ├── optimize_all_appsheet_scripts.py
│   └── deploy_all_to_gas.py
├── credentials.json      # Google OAuth認証情報
└── requirements.txt      # Python依存関係
```

## License

MIT License
