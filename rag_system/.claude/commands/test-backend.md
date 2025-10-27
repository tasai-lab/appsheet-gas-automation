# Backendテスト実行

FastAPI Backendの単体テスト・統合テストを実行する。

## 前提条件

- Backend依存パッケージインストール済み
- `pytest` インストール済み

## テスト構成

```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Pytest設定・フィクスチャ
│   ├── test_main.py             # メインアプリテスト
│   ├── test_rag_engine.py       # Hybrid Searchテスト
│   ├── test_vertex_ai.py        # Vertex AIクライアントテスト
│   ├── test_spreadsheet.py      # Vector DBテスト
│   └── test_routers/
│       ├── test_chat.py         # チャットAPIテスト
│       └── test_search.py       # 検索APIテスト
```

## 実行方法

### 全テスト実行

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/backend

# 全テスト実行（詳細表示）
pytest tests/ -v

# カバレッジ付き
pytest tests/ --cov=app --cov-report=html
```

### 特定テストのみ実行

```bash
# メインアプリのみ
pytest tests/test_main.py -v

# Hybrid Searchのみ
pytest tests/test_rag_engine.py -v

# チャットAPIのみ
pytest tests/test_routers/test_chat.py -v
```

### マーカー付きテスト実行

```bash
# 統合テストのみ
pytest tests/ -m integration -v

# 単体テストのみ
pytest tests/ -m unit -v

# API呼び出しを含むテストのみ
pytest tests/ -m api_call -v
```

## テストフィクスチャ

### conftest.py

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    """FastAPI TestClient"""
    return TestClient(app)

@pytest.fixture
def mock_vertex_ai():
    """Vertex AI モック"""
    # モック実装
    pass

@pytest.fixture
def sample_embeddings():
    """サンプル埋め込みベクトル (3072次元)"""
    return [0.1] * 3072
```

## テスト例

### 1. ヘルスチェックテスト

```python
def test_health_check(client):
    """ヘルスチェックエンドポイント"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

### 2. Hybrid Searchテスト

```python
@pytest.mark.integration
def test_hybrid_search(client):
    """Hybrid Search統合テスト"""
    payload = {
        "query": "バルーンカテーテル",
        "top_k": 10,
        "user_id": "test_user"
    }
    response = client.post("/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) > 0
```

### 3. Embedding生成テスト

```python
@pytest.mark.api_call
def test_create_embedding(mock_vertex_ai):
    """Embedding生成テスト"""
    text = "訪問看護記録"
    embedding = create_embedding(text)
    assert len(embedding) == 3072
    assert all(isinstance(x, float) for x in embedding)
```

## API呼び出しカウンターテスト

**重要**: API呼び出し回数を必ず確認

```python
import pytest
from unittest.mock import patch, call

@pytest.mark.api_call
def test_api_call_count():
    """API呼び出し回数確認"""
    with patch('app.services.vertex_ai.call_api') as mock_api:
        # テスト実行
        result = process_request("test query")

        # API呼び出しは1回のみ
        assert mock_api.call_count == 1

        # リトライループがないこと確認
        assert mock_api.call_count <= 1
```

## カバレッジ確認

```bash
# カバレッジレポート生成
pytest tests/ --cov=app --cov-report=html

# レポート表示
open htmlcov/index.html
```

**目標カバレッジ**:
- 全体: 80%以上
- コアロジック: 90%以上

## CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/test-backend.yml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          cd backend
          pytest tests/ -v --cov=app
```

## トラブルシューティング

### Vertex AI認証エラー

```bash
# サービスアカウント認証
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# または環境変数設定
export GCP_PROJECT_ID=fractal-ecosystem
```

### Spreadsheet接続エラー

```bash
# Vector DB SpreadsheetIDを環境変数に設定
export VECTOR_DB_SPREADSHEET_ID="your-spreadsheet-id"
```

### Import エラー

```bash
# Pythonパス追加
export PYTHONPATH="${PYTHONPATH}:/Users/t.asai/code/appsheet-gas-automation/rag_system/backend"
```

---

**最終更新**: 2025-10-27
