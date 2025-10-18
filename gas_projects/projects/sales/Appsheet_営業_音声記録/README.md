# Appsheet_営業_音声記録

**Script ID:** 1y0VoKXs0RuYNkZ0-IqD4W50aaeouoT1kcAiJTTbjzmY7z1N8xY26EAgr

**Created:** 2025-07-22T13:31:47.319Z

**Modified:** 2025-10-16T11:52:17.980Z

**Owners:** 

## 概要

営業活動の音声記録を**Vertex AI（Gemini 2.0 Flash Exp）**で分析し、評価指標IDを含む定量・定性評価を自動生成するプロジェクトです。

**通話_要約生成プロジェクトと同様の共通モジュール**を使用：
- `drive_utils.gs`: ファイル取得・検証・エンコーディング（Vertex AIパターン準拠）
- `vertex_ai_service.gs`: Vertex AI API連携（inlineData方式、20MB対応）
- `config.gs`: GCP設定管理

## 必須パラメータ

| パラメータ | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| `activityId` | string | 活動ID（必須） | "ACT-001" |
| `audioFileId` | string | Google Drive音声ファイルID（必須） | "1a2b3c4d5e..." |
| `salespersonName` | string | 営業担当者名（任意） | "山田太郎" |
| `contactName` | string | 面会相手名（任意） | "田中花子" |
| `orgName` | string | 訪問先機関名（任意） | "○○事業所" |

> **注意**: `rowUrl`パラメータは現在**実装されていません**。
> 
> `rowUrl`は、イベント・タスク作成プロジェクト（`Appsheet_通話_イベント・タスク作成`）で使用されるAppSheet行URLパラメータです。このプロジェクトでは、`activityId`で活動を特定するため、`rowUrl`は不要です。

## Structure

- `scripts/`: Contains all GAS script files
- `spreadsheets/`: Contains metadata for referenced spreadsheets
- `appsscript.json`: Project manifest
- `project_metadata.json`: Complete project metadata
- `SCRIPT_ARCHITECTURE.md`: スクリプトアーキテクチャ詳細
- `FLOW.md`: システムフロー図
- `SPECIFICATIONS.md`: 仕様書

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)
