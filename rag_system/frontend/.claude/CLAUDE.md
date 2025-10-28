# Frontend - Claude Code ガイド

**プロジェクト**: RAG Medical Assistant - Next.js Frontend
**現在**: V3移行プロジェクト（Phase 3: Frontend実装待ち）
**担当フェーズ**: Phase 3（Frontend実装）= 7日間
**技術スタック**: Next.js 14 + React + TypeScript + Tailwind CSS
**最終更新**: 2025-10-28

---

## 🎯 Frontend担当のV3タスク（7日間）

### Phase 3: Frontend実装（7日間、2025-11-26〜2025-12-03）

- [ ] **Task 3.1: 進捗バー実装**（2日、優先度: 🔴）
  - **ファイル**: 
    - `src/components/ProgressBar.tsx` ← 新規作成
    - `src/hooks/useProgress.ts` ← 新規作成
  - **機能**:
    - ProgressBarコンポーネント作成
    - useProgress カスタムHook作成
    - SSEイベントリスナー統合
    - ステージ別進捗表示（optimize: 10% → vectorize: 30% → search: 60% → rerank: 80% → generating: 100%）
    - アニメーション効果（Tailwind transition）
  - **担当**: Frontend開発者

- [ ] **Task 3.2: API統合**（3日、優先度: 🔴）
  - **ファイル**:
    - `src/lib/api.ts` ← 更新（V3エンドポイント追加）
    - `src/components/ChatContainer.tsx` ← 更新（進捗イベント処理）
  - **機能**:
    - Backend V3 API エンドポイント統合（`/chat/v3/stream`）
    - SSEストリーミング受信処理（新形式イベント）
    - エラーハンドリング強化
    - Abort機能（処理中止）
  - **担当**: Frontend開発者

- [ ] **Task 3.3: UI/UX調整**（2日、優先度: 🟡）
  - **ファイル**:
    - `src/components/*.tsx` ← 全体調整
    - `src/styles/globals.css` ← スタイル調整
  - **機能**:
    - レイアウト調整（進捗バー配置）
    - レスポンシブ対応確認（モバイル・タブレット・デスクトップ）
    - ダークモード対応確認
    - アクセシビリティ改善（ARIA属性追加）
  - **担当**: Frontend開発者

**詳細**: [../../docs/V3_TASKS.md](../../docs/V3_TASKS.md)

**設計書**: [../../docs/V3_ARCHITECTURE.md](../../docs/V3_ARCHITECTURE.md) Section 7.1（進捗バーUI）

---

## 🚀 クイックスタート

### セットアップ

```bash
cd frontend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localを編集してAPIエンドポイントとFirebase設定を追加

# 開発サーバー起動
npm run dev
```

### よく使うコマンド

```bash
npm run dev          # 開発サーバー起動（localhost:3000）
npm run build        # プロダクションビルド
npm run start        # プロダクションサーバー起動
npm run lint         # ESLint実行
npm run type-check   # TypeScript型チェック
```

---

## ⚠️ 最重要な制約

### 1. API呼び出し: リトライループ厳禁

**絶対に禁止:**
```typescript
// ❌ 絶対に書かない
for (let i = 0; i < 3; i++) {
  try {
    const result = await apiCall();
    break;
  } catch {
    continue;  // リトライループ
  }
}
```

**正しいパターン:**
```typescript
// ✅ 1回のみ実行
try {
  console.log('[API] 呼び出し開始');
  const result = await apiCall();
  console.log('[API] 呼び出し成功');
  return result;
} catch (error) {
  console.error('[API] 呼び出し失敗:', error);
  throw error;  // 即座にthrow（リトライしない）
}
```

**理由**: 過去に200,000+ API呼び出し/日の事故発生（参照: [../../docs/ERROR_LOG.md](../../docs/ERROR_LOG.md)）

### 2. 認証トークン: 必ず取得してAuthorizationヘッダーに設定

```typescript
import { useAuth } from '@/contexts/AuthContext';

const { getIdToken } = useAuth();

// API呼び出し前にトークン取得
const token = await getIdToken();

// Authorizationヘッダーに設定
const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
};
```

### 3. Context APIは1回のみ使用（重複防止）

```typescript
// ✅ Context APIで一元管理
import { useClients } from '@/contexts/ClientsContext';

const { clients, loading } = useClients();  // 自動的にキャッシュされる
```

---

## 📁 Frontend プロジェクト構造（V3対応）

```
frontend/
├── public/                    # 静的ファイル
│   └── f-assistant.png        # ロゴ画像
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # ルートレイアウト（プロバイダー設定）
│   │   ├── page.tsx           # ホームページ（Protected）
│   │   ├── login/
│   │   │   └── page.tsx       # ログインページ
│   │   └── test-auth/
│   │       └── page.tsx       # 認証テストページ
│   ├── components/            # UIコンポーネント
│   │   ├── ChatContainer.tsx  # チャットメインコンテナ ← Task 3.2で更新
│   │   ├── ProgressBar.tsx    # ⭐ 進捗バー ← Task 3.1で新規作成
│   │   ├── MessageList.tsx    # メッセージ一覧
│   │   ├── MessageInput.tsx   # メッセージ入力
│   │   ├── Message.tsx        # 個別メッセージ
│   │   ├── Sidebar.tsx        # サイドバー（履歴・ユーザー情報）
│   │   ├── Context.tsx        # コンテキスト参照表示
│   │   ├── NewChatModal.tsx   # 新規チャット作成モーダル
│   │   └── ClientAutocomplete.tsx  # 利用者オートコンプリート
│   ├── contexts/              # グローバル状態管理
│   │   ├── AuthContext.tsx    # Firebase認証
│   │   ├── ClientsContext.tsx # 利用者情報（API重複防止）
│   │   └── ThemeContext.tsx   # ダークモードテーマ
│   ├── hooks/                 # カスタムHooks
│   │   └── useProgress.ts     # ⭐ 進捗管理Hook ← Task 3.1で新規作成
│   ├── lib/                   # ユーティリティ
│   │   ├── api.ts             # Backend API呼び出し ← Task 3.2で更新
│   │   └── firebase.ts        # Firebase設定
│   ├── types/
│   │   └── chat.ts            # 型定義
│   └── styles/
│       └── globals.css        # グローバルスタイル
├── .env.local                 # 環境変数（Git除外）
├── .env.example               # 環境変数テンプレート
├── next.config.js             # Next.js設定
├── tailwind.config.ts         # Tailwind CSS設定
├── tsconfig.json              # TypeScript設定
└── package.json               # 依存関係
```

---

## 🆕 V3新コンポーネント実装ガイド

### 1. ProgressBar.tsx - Task 3.1

**実装仕様**:
```typescript
import React from 'react';

interface ProgressBarProps {
  stage: 'idle' | 'optimize' | 'vectorize' | 'search' | 'rerank' | 'generating' | 'done';
  visible: boolean;
}

const STAGE_PROGRESS = {
  idle: 0,
  optimize: 10,
  vectorize: 30,
  search: 60,
  rerank: 80,
  generating: 100,
  done: 100,
};

const STAGE_LABELS = {
  idle: '待機中',
  optimize: 'プロンプト最適化中...',
  vectorize: 'ベクトル化中...',
  search: '検索中...',
  rerank: 'リランキング中...',
  generating: '回答生成中...',
  done: '完了',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({ stage, visible }) => {
  if (!visible) return null;

  const progress = STAGE_PROGRESS[stage];
  const label = STAGE_LABELS[stage];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-96 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {label}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-right">
        {progress}%
      </div>
    </div>
  );
};
```

### 2. useProgress.ts - Task 3.1

**実装仕様**:
```typescript
import { useState, useCallback } from 'react';

type ProgressStage = 'idle' | 'optimize' | 'vectorize' | 'search' | 'rerank' | 'generating' | 'done';

export const useProgress = () => {
  const [stage, setStage] = useState<ProgressStage>('idle');
  const [visible, setVisible] = useState(false);

  const updateStage = useCallback((newStage: ProgressStage) => {
    setStage(newStage);
    if (newStage !== 'idle' && newStage !== 'done') {
      setVisible(true);
    }
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setVisible(false);
  }, []);

  const complete = useCallback(() => {
    setStage('done');
    // 1秒後に非表示
    setTimeout(() => {
      setVisible(false);
      setStage('idle');
    }, 1000);
  }, []);

  return {
    stage,
    visible,
    updateStage,
    reset,
    complete,
  };
};
```

### 3. ChatContainer.tsx更新 - Task 3.2

**SSEイベント処理の追加**:
```typescript
import { useProgress } from '@/hooks/useProgress';

export const ChatContainer = () => {
  // ... 既存のstate
  const { stage, visible, updateStage, reset, complete } = useProgress();

  const handleSendMessage = async (messageText: string) => {
    // ... 既存のコード

    reset();  // 進捗リセット

    try {
      const stream = streamChatMessage({
        message: messageText,
        session_id: sessionId || undefined,
        client_id: selectedClientId || undefined,
      }, abortController.signal, token);

      for await (const chunk of stream) {
        if (chunk.type === "progress") {
          // ⭐ V3新機能: 進捗イベント
          updateStage(chunk.stage);
        } else if (chunk.type === "status") {
          // V2互換
          setCurrentStatus(chunk.status);
        } else if (chunk.type === "context") {
          setContext(chunk.context);
        } else if (chunk.type === "text") {
          accumulatedText += chunk.content;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content = accumulatedText;
            return updated;
          });
        } else if (chunk.type === "done") {
          complete();  // 進捗完了
        }
      }
    } catch (error) {
      console.error('[ChatContainer] Stream error:', error);
      reset();  // エラー時も進捗リセット
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* ... 既存のコンポーネント */}
      
      {/* ⭐ V3新機能: 進捗バー */}
      <ProgressBar stage={stage} visible={visible} />
    </div>
  );
};
```

### 4. api.ts更新 - Task 3.2

**V3エンドポイント追加**:
```typescript
export async function* streamChatMessage(
  request: ChatRequest,
  signal: AbortSignal,
  token: string
): AsyncGenerator<StreamChunk> {
  // ⭐ V3エンドポイント使用
  const endpoint = process.env.NEXT_PUBLIC_USE_V3_API === 'true'
    ? '/chat/v3/stream'
    : '/chat/stream';

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data);
          yield chunk;
        } catch (e) {
          console.error('[API] Parse error:', e);
        }
      }
    }
  }
}
```

---

## 💻 コーディング規約

### TypeScript スタイル

```typescript
// ✅ 型定義必須
interface Props {
  message: string;
  onSend: (text: string) => void;
}

const MyComponent: React.FC<Props> = ({ message, onSend }) => {
  // ...
};

// ✅ async/await使用
const fetchData = async () => {
  try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};
```

### React Hooks順序

```typescript
const MyComponent = () => {
  // 1. useState
  const [state, setState] = useState(initialState);

  // 2. useContext
  const { user } = useAuth();

  // 3. useEffect
  useEffect(() => {
    // ...
  }, []);

  // 4. カスタムHooks
  const { data, loading } = useCustomHook();

  return <div>{/* ... */}</div>;
};
```

---

## ✅ Frontend開発チェックリスト

### タスク開始前

- [ ] [V3_TASKS.md](../../docs/V3_TASKS.md) でタスク詳細を確認
- [ ] [V3_ARCHITECTURE.md](../../docs/V3_ARCHITECTURE.md) Section 7（Frontend UI）を確認
- [ ] [ERROR_LOG.md](../../docs/ERROR_LOG.md) で過去のエラーを確認
- [ ] ブランチ作成: `git checkout -b feature/task-X.Y`

### 実装中

- [ ] 型定義必須（TypeScript strict mode）
- [ ] Propsインターフェース定義
- [ ] コンソールログ適切に配置（`[ComponentName]` プレフィックス）
- [ ] API呼び出しは1回のみ（リトライループ厳禁）
- [ ] レスポンシブ対応（Tailwind breakpoints使用）
- [ ] ダークモード対応（`dark:` クラス）

### タスク完了後 ⭐ **必須**

- [ ] `npm run build` 成功
- [ ] `npm run lint` 成功
- [ ] `npm run type-check` 成功
- [ ] ブラウザ動作確認（Chrome, Firefox, Safari）
- [ ] **[V3_PROGRESS.md](../../docs/V3_PROGRESS.md) を即座に更新** ⭐ **最重要**
- [ ] **Slackに完了報告を投稿** ⭐ **最重要**
- [ ] PR作成（[PROJECT_MANAGEMENT.md](../../docs/PROJECT_MANAGEMENT.md) テンプレート使用）
- [ ] コードレビュー依頼

---

## 📣 タスク完了時の進捗シェア（Frontend開発者向け）

### ⚠️ タスク完了時は必ず実施

#### 1. V3_PROGRESS.md を即座に更新

```bash
# 完了タスクをチェック
- [x] Task 3.Y: タスク名

# Phase進捗率を更新
Phase 3: Frontend実装 [▰▰▰▰▱▱▱▱▱▱] 40% → 60%
```

#### 2. Slackに完了報告（テンプレート）

```
✅ Frontend Task完了

【タスク】: Task 3.Y - タスク名
【完了日時】: YYYY-MM-DD HH:MM
【成果物】:
- src/components/XXX.tsx（コンポーネント実装）
- src/hooks/useXXX.ts（カスタムHook）
- src/lib/xxx.ts（ユーティリティ、該当する場合）

【テスト結果】:
- npm run build: 成功
- npm run lint: エラーなし
- npm run type-check: エラーなし
- ブラウザ確認: Chrome ✅ Firefox ✅ Safari ✅

【UI確認】:
- レスポンシブ: モバイル ✅ タブレット ✅ デスクトップ ✅
- ダークモード: 動作確認済み ✅
- アクセシビリティ: ARIA属性追加済み ✅

【次のタスク】: Task 3.Y+1
【見積】: X日

【ブロッカー】: なし
```

#### 3. 良い報告例（Frontend）

```
✅ Task 3.1完了 - 進捗バー実装

【完了日時】: 2025-11-27 18:00
【成果物】:
- src/components/ProgressBar.tsx（120行）
- src/hooks/useProgress.ts（80行）
- src/components/ChatContainer.tsx（進捗イベント処理追加）

【テスト結果】:
- npm run build: 成功
- npm run lint: エラーなし
- npm run type-check: エラーなし
- バンドルサイズ: +2.3KB（許容範囲内）

【UI確認】:
- 進捗バー表示: 画面下部中央 ✅
- ステージ遷移: optimize → vectorize → search → rerank → generating ✅
- アニメーション: Tailwind transition (500ms) ✅
- レスポンシブ: モバイル（w-full）、デスクトップ（w-96）✅
- ダークモード: bg-gray-800対応済み ✅

【パフォーマンス】:
- 再レンダリング: 最適化済み（useCallback使用）
- 進捗更新レイテンシ: < 100ms

【次のタスク】: Task 3.2 - API統合
【見積】: 3日

【ブロッカー】: なし
```

#### 4. 日次報告（毎日17:00）

**Frontend開発者の日次報告**:
- 実装したコンポーネント名と機能
- UIテスト結果（レスポンシブ、ダークモード、ブラウザ互換性）
- 明日の実装計画

---

## 🎨 スタイリングガイド

### 進捗バー配置

```tsx
{/* 画面下部中央に固定表示 */}
<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-96">
  {/* Popup形式 */}
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
    {/* コンテンツ */}
  </div>
</div>
```

### アニメーション

```tsx
{/* Tailwind transition使用 */}
<div className="transition-all duration-500 ease-out">
  {/* アニメーション対象 */}
</div>
```

### レスポンシブ

```tsx
{/* モバイル: w-full, デスクトップ: w-96 */}
<div className="w-full sm:w-96">
  {/* コンテンツ */}
</div>
```

---

## 📚 関連ドキュメント

### V3プロジェクト
- **[V3_TASKS.md](../../docs/V3_TASKS.md)** - Frontend担当タスク詳細（Task 3.1-3.3）
- **[V3_ARCHITECTURE.md](../../docs/V3_ARCHITECTURE.md)** - Section 7（Frontend UI設計）
- **[V3_PROGRESS.md](../../docs/V3_PROGRESS.md)** - 進捗追跡
- **[TEAM_ASSIGNMENT.md](../../docs/TEAM_ASSIGNMENT.md)** - Frontend役割（Phase 3メイン）

### コア
- **[ERROR_LOG.md](../../docs/ERROR_LOG.md)** ⭐ 必読
- **[04_API_SPECIFICATION.md](../../docs/04_API_SPECIFICATION.md)** - API仕様
- **[07_SECURITY.md](../../docs/07_SECURITY.md)** - セキュリティ設計

---

**最終更新**: 2025-10-28
**次回レビュー**: Phase 3開始時（2025-11-26）
