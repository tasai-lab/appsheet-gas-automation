"""
統合テスト（Integration Tests）

このディレクトリには、複数コンポーネントを統合したテストを配置します。

テスト実行要件:
- Cloud SQL インスタンスが起動していること
- .env に接続情報が設定されていること
- 必要なGCP認証情報が設定されていること

実行方法:
```bash
# 全統合テスト実行
pytest tests/integration/

# 特定のテストファイル実行
pytest tests/integration/test_mysql_connection.py
pytest tests/integration/test_search_e2e.py

# Cloud SQL未起動時はスキップ
pytest tests/integration/ -v
# -> SKIPPED [1] tests/integration/test_mysql_connection.py: Cloud SQL not available
```

環境変数:
- SKIP_INTEGRATION_TESTS=1 : 統合テストをスキップ
- CLOUD_SQL_CONNECTION_NAME : Cloud SQL接続名
- DB_NAME : データベース名
- DB_USER : データベースユーザー
- DB_PASSWORD : データベースパスワード
"""
