# =============================================================================
# RAG Medical Assistant API - Dockerfile
# =============================================================================

# ベースイメージ
FROM python:3.11-slim

# 作業ディレクトリ設定
WORKDIR /app

# 環境変数設定
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# システムパッケージ更新
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコピー
COPY ./app ./app

# ポート公開（Cloud Run用に環境変数PORTを使用）
ENV PORT=8080
EXPOSE ${PORT}

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:${PORT}/health')" || exit 1

# アプリケーション起動（PORT環境変数から取得）
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
