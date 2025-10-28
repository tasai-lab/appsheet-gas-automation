# Cloud SQL for MySQL セットアップガイド

**対象**: RAG V3 データベース環境構築
**最終更新**: 2025-10-28
**推定作業時間**: 1-2時間

---

## 📋 目次

1. [前提条件](#前提条件)
2. [Cloud SQL インスタンス作成](#cloud-sql-インスタンス作成)
3. [データベースとユーザーの作成](#データベースとユーザーの作成)
4. [SSL証明書の設定](#ssl証明書の設定)
5. [Backend環境変数の設定](#backend環境変数の設定)
6. [接続テスト](#接続テスト)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必要な権限

- GCPプロジェクト: `fractal-ecosystem`
- 必要なIAMロール:
  - `Cloud SQL Admin` (cloudsql.admin)
  - `Service Account User` (iam.serviceAccountUser)

### 必要なツール

```bash
# Google Cloud CLI
gcloud --version  # 必須

# Cloud SQL Proxy（ローカル開発用）
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.7.2/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/

# MySQL Client（オプション、検証用）
brew install mysql-client
```

### APIの有効化

```bash
# Cloud SQL Admin API有効化
gcloud services enable sqladmin.googleapis.com --project=fractal-ecosystem

# Compute Engine API有効化（Private IP使用時）
gcloud services enable compute.googleapis.com --project=fractal-ecosystem

# Service Networking API有効化（Private IP使用時）
gcloud services enable servicenetworking.googleapis.com --project=fractal-ecosystem
```

---

## Cloud SQL インスタンス作成

### Step 1: インスタンス仕様の確認

| 項目 | 設定値 |
|------|--------|
| **インスタンス名** | `rag-system-mysql` |
| **データベースバージョン** | MySQL 9.0 |
| **リージョン** | `us-central1` |
| **ゾーン** | `us-central1-a`（シングルゾーン） |
| **マシンタイプ** | `db-n1-standard-2` |
| **vCPU** | 2 |
| **メモリ** | 7.5 GB |
| **ストレージタイプ** | SSD |
| **ストレージ容量** | 50 GB |
| **ストレージ自動増加** | 有効（上限: 200 GB） |
| **バックアップ** | 自動（毎日4:00 UTC、7日保持） |
| **高可用性** | 無効（開発環境）※本番環境では有効化推奨 |

### Step 2: GCPコンソールでの作成

#### 2.1 インスタンス作成開始

```bash
# GCPコンソールにアクセス
open https://console.cloud.google.com/sql/instances?project=fractal-ecosystem
```

または gcloud コマンドで作成:

```bash
gcloud sql instances create rag-system-mysql \
  --database-version=MYSQL_9_0 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=50GB \
  --storage-auto-increase \
  --storage-auto-increase-limit=200 \
  --backup-start-time=04:00 \
  --retained-backups-count=7 \
  --enable-bin-log \
  --no-assign-ip \
  --network=projects/fractal-ecosystem/global/networks/default \
  --project=fractal-ecosystem
```

**重要ポイント**:
- `--no-assign-ip`: Public IPを割り当てない（セキュリティ強化）
- `--network`: VPCネットワークを指定（Private IP用）
- `--database-version=MYSQL_9_0`: **MySQL 9.0** を指定（VECTOR型サポート必須）

#### 2.2 Private IP接続の設定

Private IP接続を有効化（セキュリティ上推奨）:

```bash
# Service Networking接続を作成（初回のみ）
gcloud compute addresses create google-managed-services-default \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=default \
  --project=fractal-ecosystem

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default \
  --project=fractal-ecosystem
```

#### 2.3 インスタンス作成完了確認

```bash
# インスタンス一覧確認
gcloud sql instances list --project=fractal-ecosystem

# インスタンス詳細確認
gcloud sql instances describe rag-system-mysql --project=fractal-ecosystem
```

**出力例**:
```
name: rag-system-mysql
state: RUNNABLE
ipAddresses:
- ipAddress: 10.xxx.xxx.xxx  # Private IP
  type: PRIVATE
```

### Step 3: MySQL 9.0のVector型サポート確認

MySQL 9.0はVECTOR型をネイティブサポートしています。確認方法:

```sql
-- 接続後に実行
SELECT VERSION();
-- 出力: 9.0.x

-- Vector型のテスト
CREATE TABLE test_vector (
  id INT PRIMARY KEY,
  embedding VECTOR(2048)
);

-- 成功すればOK
DROP TABLE test_vector;
```

---

## データベースとユーザーの作成

### Step 1: rootパスワードの設定

```bash
# rootパスワード設定
gcloud sql users set-password root \
  --host=% \
  --instance=rag-system-mysql \
  --password="YOUR_SECURE_ROOT_PASSWORD" \
  --project=fractal-ecosystem
```

**セキュリティ上の注意**:
- 強力なパスワードを使用（16文字以上、大小英数字+記号）
- パスワードは安全な場所に保管（GCP Secret Manager推奨）

### Step 2: アプリケーション用データベース作成

```bash
# Cloud SQL Proxy経由で接続
cloud-sql-proxy fractal-ecosystem:us-central1:rag-system-mysql &

# MySQL接続
mysql -h 127.0.0.1 -u root -p
```

SQL実行:

```sql
-- データベース作成
CREATE DATABASE rag_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 確認
SHOW DATABASES;
```

### Step 3: アプリケーション用ユーザー作成

```sql
-- ユーザー作成
CREATE USER 'rag_user'@'%' IDENTIFIED BY 'YOUR_SECURE_RAG_USER_PASSWORD';

-- 権限付与
GRANT ALL PRIVILEGES ON rag_system.* TO 'rag_user'@'%';

-- 権限反映
FLUSH PRIVILEGES;

-- 確認
SELECT User, Host FROM mysql.user WHERE User = 'rag_user';
```

**パスワード要件**:
- 最低16文字
- 大文字・小文字・数字・記号を含む
- 辞書にない文字列

### Step 4: スキーマ作成

```bash
# スキーマSQLファイル実行
mysql -h 127.0.0.1 -u rag_user -p rag_system < backend/sql/schema.sql
```

確認:

```sql
USE rag_system;

-- テーブル一覧
SHOW TABLES;

-- 出力:
-- +----------------------+
-- | Tables_in_rag_system |
-- +----------------------+
-- | knowledge_base       |
-- | embeddings           |
-- | clients              |
-- | chat_sessions        |
-- | chat_messages        |
-- | vector_search_stats  |
-- +----------------------+

-- embeddingsテーブルのVector型確認
DESCRIBE embeddings;

-- 出力:
-- +------------+---------------+------+-----+---------+----------------+
-- | Field      | Type          | Null | Key | Default | Extra          |
-- +------------+---------------+------+-----+---------+----------------+
-- | id         | int           | NO   | PRI | NULL    | auto_increment |
-- | kb_id      | varchar(255)  | NO   | MUL | NULL    |                |
-- | embedding  | vector(2048)  | NO   |     | NULL    |                |  ← VECTOR型
-- | created_at | timestamp     | YES  |     | CURRENT_TIMESTAMP |     |
-- +------------+---------------+------+-----+---------+----------------+
```

---

## SSL証明書の設定

### Step 1: SSL証明書のダウンロード

```bash
# 証明書保存ディレクトリ作成
mkdir -p backend/certs

# Server CA証明書ダウンロード
gcloud sql ssl-certs describe server-ca.pem \
  --instance=rag-system-mysql \
  --project=fractal-ecosystem \
  --format="get(cert)" > backend/certs/server-ca.pem

# Client証明書作成
gcloud sql ssl-certs create rag-backend-cert backend/certs/client-key.pem \
  --instance=rag-system-mysql \
  --project=fractal-ecosystem

# Client証明書ダウンロード
gcloud sql ssl-certs describe rag-backend-cert \
  --instance=rag-system-mysql \
  --project=fractal-ecosystem \
  --format="get(cert)" > backend/certs/client-cert.pem
```

### Step 2: 証明書の権限設定

```bash
# 権限設定（読み取り専用）
chmod 600 backend/certs/client-key.pem
chmod 644 backend/certs/server-ca.pem
chmod 644 backend/certs/client-cert.pem

# 所有者確認
ls -la backend/certs/
```

### Step 3: .gitignore設定

```bash
# backend/.gitignoreに追加
echo "certs/*.pem" >> backend/.gitignore
```

**重要**: 証明書ファイルはGitにコミットしないこと

---

## Backend環境変数の設定

### Step 1: Private IP取得

```bash
# Private IP取得
gcloud sql instances describe rag-system-mysql \
  --project=fractal-ecosystem \
  --format="get(ipAddresses[0].ipAddress)"

# 出力例: 10.xxx.xxx.xxx
```

### Step 2: .envファイル作成

`backend/.env` を作成:

```env
# ================================================================
# Cloud SQL (MySQL) 設定 - V3
# ================================================================

# MySQL接続設定
MYSQL_HOST=10.xxx.xxx.xxx  # ← 上記で取得したPrivate IP
MYSQL_PORT=3306
MYSQL_DATABASE=rag_system
MYSQL_USER=rag_user
MYSQL_PASSWORD=YOUR_SECURE_RAG_USER_PASSWORD  # ← Step 3で設定したパスワード

# MySQL SSL設定（本番環境推奨）
MYSQL_SSL_ENABLED=true
MYSQL_SSL_CA=certs/server-ca.pem
MYSQL_SSL_CERT=certs/client-cert.pem
MYSQL_SSL_KEY=certs/client-key.pem

# MySQL コネクションプール設定
MYSQL_POOL_SIZE=10
MYSQL_POOL_RECYCLE=3600
MYSQL_POOL_TIMEOUT=30
MYSQL_POOL_PRE_PING=true

# V3機能フラグ
USE_RAG_ENGINE_V3=false  # テスト完了後にtrueに変更
PROMPT_OPTIMIZER_ENABLED=false  # テスト完了後にtrueに変更

# プロンプト最適化設定
PROMPT_OPTIMIZER_MODEL=gemini-2.5-flash-lite
PROMPT_OPTIMIZER_TEMPERATURE=0.2
PROMPT_OPTIMIZER_MAX_OUTPUT_TOKENS=500
PROMPT_OPTIMIZER_CACHE_TTL=3600

# V3検索設定
V3_VECTOR_SEARCH_LIMIT=100  # Vector Searchで取得する候補数
V3_RERANK_TOP_N=20          # リランキング後の最終結果数

# ================================================================
# その他の既存設定（変更不要）
# ================================================================

# Google Cloud設定
GCP_PROJECT_ID=fractal-ecosystem
GCP_LOCATION=us-central1
GCP_PROJECT_NUMBER=411046620715

# Vertex AI設定
VERTEX_AI_EMBEDDINGS_MODEL=gemini-embedding-001
VERTEX_AI_EMBEDDINGS_DIMENSION=2048
VERTEX_AI_GENERATION_MODEL=gemini-2.5-flash
VERTEX_AI_TEMPERATURE=0.3
VERTEX_AI_MAX_OUTPUT_TOKENS=2048

# Vertex AI思考モード設定
VERTEX_AI_ENABLE_THINKING=true
VERTEX_AI_THINKING_BUDGET=-1
VERTEX_AI_INCLUDE_THOUGHTS=false

# Vertex AI Ranking API設定
RERANKER_TYPE=vertex_ai_ranking_api
RERANKER_MODEL=semantic-ranker-default-004
RERANKER_TOP_N=10

# Firestore設定（V2互換）
USE_FIRESTORE_CHAT_HISTORY=true
USE_FIRESTORE_VECTOR_SEARCH=false

# キャッシュ設定
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=3600
CACHE_EMBEDDINGS_TTL=86400
CACHE_SEARCH_RESULTS_TTL=1800

# セキュリティ設定
ADMIN_API_KEY=your-admin-api-key-here
REQUIRE_AUTHENTICATION=true

# Firebase Admin設定
FIREBASE_ADMIN_CREDENTIALS_JSON='{...}'  # サービスアカウントJSON
```

### Step 3: .env.exampleの更新

```bash
# .env.exampleも更新してチームに共有
cp backend/.env backend/.env.example

# パスワード・APIキーをプレースホルダーに置き換え
sed -i '' 's/MYSQL_PASSWORD=.*/MYSQL_PASSWORD=YOUR_SECURE_PASSWORD_HERE/' backend/.env.example
sed -i '' 's/ADMIN_API_KEY=.*/ADMIN_API_KEY=your-admin-api-key-here/' backend/.env.example
```

---

## 接続テスト

### Test 1: Cloud SQL Proxy経由の接続テスト

```bash
# Cloud SQL Proxy起動（別ターミナル）
cloud-sql-proxy fractal-ecosystem:us-central1:rag-system-mysql

# 出力:
# Ready for new connections
```

```bash
# MySQL接続テスト
mysql -h 127.0.0.1 -u rag_user -p rag_system

# 成功すれば：
# mysql> SELECT VERSION();
# +-----------+
# | VERSION() |
# +-----------+
# | 9.0.x     |
# +-----------+
```

### Test 2: Backend接続テスト

```bash
cd backend

# Python仮想環境有効化
source venv/bin/activate

# Pythonインタラクティブシェル
python
```

```python
from app.database import db_manager

# 接続テスト
async def test_connection():
    await db_manager.connect()
    print("✅ Database connection successful!")
    await db_manager.disconnect()

# 実行
import asyncio
asyncio.run(test_connection())

# 出力:
# ✅ Database connection successful!
```

### Test 3: Vector Search テスト

```python
from app.services.mysql_client import get_mysql_client

async def test_vector_search():
    client = get_mysql_client()

    # ダミーベクトル（2048次元）
    query_vector = [0.1] * 2048

    # Vector Search実行
    results = await client.vector_search(
        query_vector=query_vector,
        limit=10
    )

    print(f"✅ Vector Search successful! Found {len(results)} results")

asyncio.run(test_vector_search())

# 出力:
# [MySQLVectorClient] Vector Search開始: limit=10, domain=None, user_id=None
# [MySQLVectorClient] Vector Search完了: 0件, XX.XXms
# ✅ Vector Search successful! Found 0 results
```

**注意**: 初回は0件（データ未移行）が正常

### Test 4: Health Check

```bash
# Backend起動
cd backend
uvicorn app.main:app --reload

# 別ターミナルでHealth Check
curl http://localhost:8000/health

# 出力:
# {
#   "status": "healthy",
#   "mysql": {
#     "status": "healthy",
#     "knowledge_base_count": 0,
#     "embeddings_count": 0
#   }
# }
```

---

## トラブルシューティング

### 問題1: Connection refused

**症状**:
```
ERROR 2003 (HY000): Can't connect to MySQL server on '10.xxx.xxx.xxx' (61)
```

**原因**:
- Cloud SQL ProxyがPrivate IP接続をサポートしていない
- VPCネットワーク設定が不正

**解決策**:

```bash
# 1. Cloud SQL Proxy経由で接続
cloud-sql-proxy fractal-ecosystem:us-central1:rag-system-mysql

# 2. 127.0.0.1で接続
mysql -h 127.0.0.1 -u rag_user -p

# 3. Cloud Run等の本番環境ではPrivate IP直接接続
# （VPCコネクタ設定が必要）
```

### 問題2: SSL証明書エラー

**症状**:
```
ERROR 2026 (HY000): SSL connection error: xxxx
```

**原因**:
- SSL証明書のパスが不正
- 証明書の権限が不正

**解決策**:

```bash
# 証明書の存在確認
ls -la backend/certs/

# 権限修正
chmod 600 backend/certs/client-key.pem
chmod 644 backend/certs/server-ca.pem
chmod 644 backend/certs/client-cert.pem

# .envファイルのパス確認
cat backend/.env | grep MYSQL_SSL
```

### 問題3: VECTOR型が認識されない

**症状**:
```sql
ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'VECTOR(2048)' at line 1
```

**原因**:
- MySQL バージョンが 9.0未満

**解決策**:

```bash
# MySQL バージョン確認
mysql -h 127.0.0.1 -u root -p -e "SELECT VERSION();"

# 出力が 9.0.x であることを確認
# 8.x の場合はインスタンスを再作成（MYSQL_9_0指定）
gcloud sql instances delete rag-system-mysql --project=fractal-ecosystem
# → 上記Step 2を再実行
```

### 問題4: Python接続エラー

**症状**:
```python
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, "Can't connect to MySQL server on '10.xxx.xxx.xxx' ([Errno 61] Connection refused)")
```

**原因**:
- .envファイルのMYSQL_HOSTが不正
- Cloud SQL Proxyが起動していない

**解決策**:

```bash
# 1. Cloud SQL Proxy起動確認
ps aux | grep cloud-sql-proxy

# 起動していない場合
cloud-sql-proxy fractal-ecosystem:us-central1:rag-system-mysql &

# 2. .envファイル確認
cat backend/.env | grep MYSQL_HOST

# Cloud SQL Proxy経由の場合: MYSQL_HOST=127.0.0.1
# Private IP直接接続の場合: MYSQL_HOST=10.xxx.xxx.xxx
```

### 問題5: コネクションプールエラー

**症状**:
```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached
```

**原因**:
- 接続数が上限に達した

**解決策**:

```env
# .env ファイルでプールサイズを増やす
MYSQL_POOL_SIZE=20
MYSQL_POOL_TIMEOUT=60
```

---

## 次のステップ

### ✅ Cloud SQL セットアップ完了後

1. **データ移行準備**:
   ```bash
   # Task 1.3: テストデータ移行（100件）
   cd backend
   python scripts/migrate_to_mysql.py --dry-run --limit 100
   ```

2. **Backend V3テスト**:
   ```bash
   # Task 2: Backend V3 API統合テスト
   pytest tests/test_rag_engine_v3.py -v
   ```

3. **Frontend統合**:
   - Task 3.2: Frontend API統合（Backend V3エンドポイント）
   - Task 3.3: UI/UX調整

### 📊 進捗確認

- [ ] Task 0.3: Cloud SQL インスタンス作成 ✅ 完了
- [ ] 接続テスト全て成功
- [ ] スキーマ作成完了（6テーブル）
- [ ] Backend起動確認

---

## 参考資料

### 公式ドキュメント

- [Cloud SQL for MySQL ドキュメント](https://cloud.google.com/sql/docs/mysql)
- [Cloud SQL Proxy](https://cloud.google.com/sql/docs/mysql/sql-proxy)
- [MySQL 9.0 Vector Type](https://dev.mysql.com/doc/refman/9.0/en/vector-functions.html)

### プロジェクトドキュメント

- [V3_ARCHITECTURE.md](./V3_ARCHITECTURE.md) - V3アーキテクチャ設計
- [V3_TASKS.md](./V3_TASKS.md) - V3タスク一覧
- [V3_ROADMAP.md](./V3_ROADMAP.md) - V3移行ロードマップ
- [backend/sql/schema.sql](../backend/sql/schema.sql) - データベーススキーマ

---

**作成日**: 2025-10-28
**最終更新**: 2025-10-28
**次回レビュー**: データ移行完了後
