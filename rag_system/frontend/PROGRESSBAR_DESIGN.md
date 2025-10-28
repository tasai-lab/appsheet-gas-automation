# V3 進捗バーコンポーネント 設計書

**作成日**: 2025-10-28
**実装予定**: Phase 3 - Task 3.1（2025-11-26 〜 2025-11-28）
**ステータス**: 設計フェーズ

---

## 📋 概要

### 目的

V3アーキテクチャで追加される以下の処理ステージの進捗をユーザーに視覚的にフィードバックし、待ち時間のUXを改善します。

### 処理ステージ（V3）

| ステージ | 説明 | 処理時間目標 | 進捗% |
|---------|------|------------|------|
| **Optimizing** | プロンプト最適化（Gemini 2.5 Flash-Lite） | < 1秒 | 10% |
| **Searching** | ベクトル検索（MySQL Vector Search） | < 0.5秒 | 30% |
| **Reranking** | リランキング（Vertex AI Ranking API） | < 1秒 | 60% |
| **Generating** | 回答生成（Gemini 2.5 Flash Thinking） | 2-5秒 | 80-100% |

**全体目標時間**: 5-8秒

---

## 🎨 デザイン仕様

### レイアウト

**配置**: 画面下部中央（fixed position）
**サイズ**:
- Desktop: 400px × 自動高さ
- Tablet: 350px × 自動高さ
- Mobile: 90% width × 自動高さ

### カラーパレット

**ライトモード**:
- Primary: `#2563EB` (blue-600)
- Background: `#FFFFFF` (white)
- Text: `#111827` (gray-900)
- Secondary Text: `#6B7280` (gray-500)
- Progress Bar BG: `#E5E7EB` (gray-200)

**ダークモード**:
- Primary: `#3B82F6` (blue-500)
- Background: `#1F2937` (gray-800)
- Text: `#F9FAFB` (gray-50)
- Secondary Text: `#9CA3AF` (gray-400)
- Progress Bar BG: `#374151` (gray-700)

### アニメーション

- 進捗バー: `transition-all duration-300 ease-in-out`
- ステージ変更: `opacity`, `scale` トランジション（300ms）
- 出現/消滅: `fade-in`/`fade-out`（200ms）

---

## 🧩 コンポーネント構成

### 1. ProgressBar（親コンポーネント）

**ファイル**: `src/components/ProgressBar.tsx`

**Props**:
```typescript
interface ProgressBarProps {
  status: 'optimizing' | 'searching' | 'reranking' | 'generating' | null;
  progress: number;  // 0-100
  message?: string;
  metadata?: {
    search_time_ms?: number;
    generation_time_ms?: number;
    total_time_ms?: number;
  };
  elapsedTime?: number;  // ミリ秒
  onCancel?: () => void;
}
```

**責務**:
- 進捗情報の表示
- ステージインジケーターの表示
- 中止ボタンの提供

**構造**:
```tsx
<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4">
    {/* ヘッダー: ステータスメッセージ + 進捗% */}
    <ProgressHeader status={status} progress={progress} message={message} />

    {/* 進捗バー */}
    <ProgressBarVisual progress={progress} />

    {/* ステージインジケーター */}
    <StageIndicator status={status} />

    {/* フッター: 経過時間 + 中止ボタン */}
    <ProgressFooter elapsedTime={elapsedTime} metadata={metadata} onCancel={onCancel} />
  </div>
</div>
```

### 2. ProgressHeader（子コンポーネント）

**ファイル**: `src/components/ProgressBar/ProgressHeader.tsx`

**Props**:
```typescript
interface ProgressHeaderProps {
  status: string | null;
  progress: number;
  message?: string;
}
```

**表示内容**:
```tsx
<div className="flex items-center justify-between mb-2">
  {/* 左: アイコン + メッセージ */}
  <div className="flex items-center gap-2">
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
    <span className="text-sm font-medium text-gray-900 dark:text-white">
      {getStatusMessage(status, message)}
    </span>
  </div>

  {/* 右: 進捗% */}
  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
    {progress}%
  </span>
</div>
```

**ステータスメッセージ**:
```typescript
function getStatusMessage(status: string | null, customMessage?: string): string {
  if (customMessage) return customMessage;

  const messages: Record<string, string> = {
    optimizing: 'プロンプトを最適化中...',
    searching: '情報を検索中...',
    reranking: '結果を最適化中...',
    generating: '回答を生成中...',
  };

  return messages[status || ''] || '処理中...';
}
```

### 3. ProgressBarVisual（子コンポーネント）

**ファイル**: `src/components/ProgressBar/ProgressBarVisual.tsx`

**Props**:
```typescript
interface ProgressBarVisualProps {
  progress: number;
}
```

**表示内容**:
```tsx
<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
  <div
    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
    style={{ width: `${progress}%` }}
  />
</div>
```

### 4. StageIndicator（子コンポーネント）

**ファイル**: `src/components/ProgressBar/StageIndicator.tsx`

**Props**:
```typescript
interface StageIndicatorProps {
  status: 'optimizing' | 'searching' | 'reranking' | 'generating' | null;
}
```

**表示内容**:
```tsx
<div className="flex items-center gap-2 mb-3">
  <Stage
    label="最適化"
    icon="✨"
    active={status === 'optimizing'}
    done={['searching', 'reranking', 'generating'].includes(status || '')}
  />
  <Divider />
  <Stage
    label="検索"
    icon="🔍"
    active={status === 'searching'}
    done={['reranking', 'generating'].includes(status || '')}
  />
  <Divider />
  <Stage
    label="最適化"
    icon="⚡"
    active={status === 'reranking'}
    done={status === 'generating'}
  />
  <Divider />
  <Stage
    label="生成"
    icon="✍️"
    active={status === 'generating'}
    done={false}
  />
</div>
```

### 5. Stage（孫コンポーネント）

**ファイル**: `src/components/ProgressBar/Stage.tsx`

**Props**:
```typescript
interface StageProps {
  label: string;
  icon?: string;
  active: boolean;
  done: boolean;
}
```

**表示内容**:
```tsx
<div className={`flex flex-col items-center gap-1 ${
  active ? 'scale-110' : 'scale-100'
} transition-transform duration-300`}>
  {/* アイコン */}
  <div className={`
    w-8 h-8 rounded-full flex items-center justify-center text-sm
    ${active ? 'bg-blue-600 text-white scale-110 shadow-lg' : ''}
    ${done ? 'bg-green-500 text-white' : ''}
    ${!active && !done ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : ''}
    transition-all duration-300
  `}>
    {done ? '✓' : icon || label.charAt(0)}
  </div>

  {/* ラベル */}
  <span className={`text-xs ${
    active ? 'font-semibold text-blue-600 dark:text-blue-400' :
    done ? 'text-green-600 dark:text-green-400' :
    'text-gray-500 dark:text-gray-400'
  }`}>
    {label}
  </span>
</div>
```

### 6. ProgressFooter（子コンポーネント）

**ファイル**: `src/components/ProgressBar/ProgressFooter.tsx`

**Props**:
```typescript
interface ProgressFooterProps {
  elapsedTime?: number;
  metadata?: {
    search_time_ms?: number;
    generation_time_ms?: number;
    total_time_ms?: number;
  };
  onCancel?: () => void;
}
```

**表示内容**:
```tsx
<div className="flex items-center justify-between">
  {/* 左: 経過時間 */}
  <div className="text-xs text-gray-500 dark:text-gray-400">
    {elapsedTime && (
      <span>経過時間: {(elapsedTime / 1000).toFixed(1)}秒</span>
    )}
    {metadata?.search_time_ms && (
      <span className="ml-2">
        （検索: {(metadata.search_time_ms / 1000).toFixed(2)}秒）
      </span>
    )}
  </div>

  {/* 右: 中止ボタン */}
  {onCancel && (
    <button
      onClick={onCancel}
      className="px-3 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
    >
      中止
    </button>
  )}
</div>
```

---

## 🪝 カスタムHook: useProgress

**ファイル**: `src/hooks/useProgress.ts`

**目的**: SSEストリーミングから進捗情報を抽出し、状態管理

**インターフェース**:
```typescript
interface UseProgressOptions {
  initialProgress?: number;
  autoIncrement?: boolean;  // 自動進捗更新（ストリーミング中断時）
  incrementInterval?: number;  // 自動進捗更新間隔（ms）
}

interface UseProgressReturn {
  progress: number;
  status: string | null;
  message: string | null;
  metadata: any | null;
  elapsedTime: number;
  setStatus: (status: string) => void;
  setProgress: (progress: number) => void;
  setMessage: (message: string) => void;
  setMetadata: (metadata: any) => void;
  reset: () => void;
}
```

**実装**:
```typescript
import { useState, useEffect, useRef } from 'react';

export function useProgress(options: UseProgressOptions = {}): UseProgressReturn {
  const {
    initialProgress = 0,
    autoIncrement = false,
    incrementInterval = 1000,
  } = options;

  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // 経過時間の自動更新
  useEffect(() => {
    if (status) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        setElapsedTime(Date.now() - (startTimeRef.current || 0));
      }, 100);

      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [status]);

  // 自動進捗更新（オプション）
  useEffect(() => {
    if (autoIncrement && status && progress < 90) {
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 1, 90));
      }, incrementInterval);

      return () => clearInterval(interval);
    }
  }, [autoIncrement, status, progress, incrementInterval]);

  const reset = () => {
    setProgress(initialProgress);
    setStatus(null);
    setMessage(null);
    setMetadata(null);
    setElapsedTime(0);
    startTimeRef.current = null;
  };

  return {
    progress,
    status,
    message,
    metadata,
    elapsedTime,
    setStatus,
    setProgress,
    setMessage,
    setMetadata,
    reset,
  };
}
```

---

## 🔗 ChatContainerへの統合

**ファイル**: `src/components/ChatContainer.tsx`

**統合方法**:
```typescript
import { ProgressBar } from '@/components/ProgressBar';
import { useProgress } from '@/hooks/useProgress';

export default function ChatContainer() {
  // 既存の状態
  const [loading, setLoading] = useState(false);

  // 進捗管理
  const {
    progress,
    status,
    message,
    metadata,
    elapsedTime,
    setStatus,
    setProgress,
    setMessage,
    setMetadata,
    reset,
  } = useProgress({ autoIncrement: true });

  const handleSendMessage = async (messageText: string) => {
    setLoading(true);
    reset();  // 進捗リセット

    try {
      const stream = streamChatMessage({...}, signal, token);

      for await (const chunk of stream) {
        if (chunk.type === 'status') {
          setStatus(chunk.status);
          setMessage(chunk.metadata?.message);

          // ステージ別進捗更新
          const progressMap = {
            optimizing: 10,
            searching: 30,
            reranking: 60,
            generating: 80,
          };
          setProgress(progressMap[chunk.status] || 0);
        } else if (chunk.type === 'done') {
          setProgress(100);
          setMetadata(chunk.metadata);
        }
      }
    } catch (error) {
      // エラーハンドリング
    } finally {
      setLoading(false);
      setTimeout(reset, 1000);  // 1秒後にリセット
    }
  };

  return (
    <div>
      {/* 既存のUI */}

      {/* 進捗バー */}
      {loading && (
        <ProgressBar
          status={status}
          progress={progress}
          message={message}
          metadata={metadata}
          elapsedTime={elapsedTime}
          onCancel={handleAbort}
        />
      )}
    </div>
  );
}
```

---

## 🧪 テスト仕様

### 単体テスト

**ファイル**: `frontend/tests/ProgressBar.test.tsx`

**テストケース**:
1. **描画テスト**
   - [ ] 初期状態で正しく描画される
   - [ ] 各ステージで正しいスタイルが適用される
   - [ ] 進捗%が正しく表示される

2. **アニメーションテスト**
   - [ ] 進捗バーがスムーズにアニメーションする
   - [ ] ステージ変更時にトランジションが発生する

3. **インタラクションテスト**
   - [ ] 中止ボタンをクリックするとonCancelが呼ばれる

### 統合テスト

**ファイル**: `frontend/tests/integration/ChatContainer.test.tsx`

**テストケース**:
1. **SSE統合テスト**
   - [ ] SSEステータスイベントを受信すると進捗バーが更新される
   - [ ] 完了イベントを受信すると進捗バーが消える

---

## 📚 参考資料

- **[docs/V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md#71-進捗バーの同期)** - V3進捗バー仕様
- **[docs/V3_TASKS.md](../docs/V3_TASKS.md#task-31-進捗バー実装2日)** - タスク詳細
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Framer Motion** (アニメーションライブラリ候補): https://www.framer.com/motion/

---

**作成者**: Claude (AI Assistant)
**最終更新**: 2025-10-28
**レビュアー**: TBD
**承認**: 未承認
