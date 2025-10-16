# Google Apps Script 自動化プロジェクト

> **日本語ドキュメント**: [docs/ja/README.md](docs/ja/README.md) をご覧ください

Professional automation toolkit for managing Google Apps Script (GAS) projects in Google Drive.

## Quick Links

- 📚 **[日本語ドキュメント（メイン）](docs/ja/README.md)** - プロジェクト全体の詳細
- 🤖 **[Geminiモデル仕様](docs/ja/Geminiモデル仕様.md)** - API使用ガイド
- 🔒 **[重複防止機能](docs/ja/重複防止機能.md)** - Webhook重複対策
- 📊 **[実行ログ管理](docs/ja/実行ログ管理.md)** - ログシステム
- 🚀 **[デプロイガイド](docs/ja/デプロイガイド.md)** - デプロイ手順

## Project Overview

This toolkit manages 32 Google Apps Script projects for AppSheet integration and automation:
- 30 AppSheet integration scripts
- 2 Automation scripts (Receipt & Invoice processing)
- Centralized execution logging
- Duplicate request prevention
- Gemini API optimization

## Key Features

- 🔄 **Automatic GAS Retrieval** - Download and organize all scripts from Google Drive
- 🛡️ **Duplicate Prevention** - Prevent duplicate webhook executions
- 📊 **Centralized Logging** - Track all executions in a single spreadsheet
- 🤖 **Gemini API Integration** - Optimized model selection and usage
- 🚀 **Automated Deployment** - Deploy and version management tools

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Retrieve all GAS projects
python gas_retriever.py

# Optimize scripts
python optimize_all_appsheet_scripts.py

# Deploy to GAS
python deploy_all_to_gas.py
```

## Documentation

All documentation is maintained in Japanese under `docs/ja/`:

- **README.md** - Complete project documentation
- **Geminiモデル仕様.md** - Gemini API specification
- **重複防止機能.md** - Duplicate prevention system
- **実行ログ管理.md** - Execution logging system  
- **デプロイガイド.md** - Deployment procedures

## Project Structure

```
all-gas/
├── docs/ja/              # Japanese documentation (primary)
├── gas_projects/         # Retrieved GAS projects (32 projects)
├── src/                  # Common libraries
├── ツール/                # Python automation tools
│   ├── gas_retriever.py
│   ├── optimize_all_appsheet_scripts.py
│   └── deploy_all_to_gas.py
├── credentials.json      # Google OAuth credentials
└── requirements.txt      # Python dependencies
```

## License

MIT License
