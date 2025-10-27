# Frontendテスト実行

Next.js Frontendの単体テスト・統合テストを実行する。

## 前提条件

- Frontend依存パッケージインストール済み
- `jest`, `@testing-library/react` インストール済み

## テスト構成

```
frontend/
├── __tests__/
│   ├── components/
│   │   ├── Sidebar.test.tsx
│   │   ├── ChatContainer.test.tsx
│   │   └── ThemeContext.test.tsx
│   ├── hooks/
│   │   └── useStreamingChat.test.ts
│   └── lib/
│       └── api.test.ts
├── jest.config.js
└── jest.setup.js
```

## 実行方法

### 全テスト実行

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend

# 全テスト実行
npm test

# Watch モード
npm test -- --watch

# カバレッジ付き
npm test -- --coverage
```

### 特定テストのみ実行

```bash
# Sidebarコンポーネントのみ
npm test -- Sidebar

# ChatContainerコンポーネントのみ
npm test -- ChatContainer

# APIクライアントのみ
npm test -- api.test
```

## テストケース例

### 1. Sidebarコンポーネントテスト

```typescript
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';

describe('Sidebar', () => {
  it('ロゴが表示される', () => {
    render(<Sidebar />);
    const logo = screen.getByAlt('F Assistant');
    expect(logo).toBeInTheDocument();
  });

  it('テーマ切替ボタンが動作する', () => {
    render(<Sidebar />);
    const themeButton = screen.getByTitle(/ダークモードに切り替え/i);
    fireEvent.click(themeButton);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

### 2. ThemeContextテスト

```typescript
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

describe('ThemeContext', () => {
  it('初期値はlight', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme()でdarkに切り替わる', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

### 3. SSE Streaming フック テスト

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useStreamingChat } from '@/hooks/useStreamingChat';

describe('useStreamingChat', () => {
  it('メッセージ送信が成功する', async () => {
    const { result } = renderHook(() => useStreamingChat());

    act(() => {
      result.current.sendMessage('テストメッセージ');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages.length).toBeGreaterThan(0);
  });
});
```

### 4. APIクライアントテスト

```typescript
import { sendChatMessage, streamChatMessage } from '@/lib/api';

describe('API Client', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('チャットメッセージ送信が成功する', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      response: 'テスト応答',
      contexts: [],
    }));

    const response = await sendChatMessage({
      message: 'テスト質問',
    });

    expect(response.response).toBe('テスト応答');
  });

  it('ストリーミングチャットが動作する', async () => {
    // SSE mock実装
    const mockEventSource = {
      addEventListener: jest.fn(),
      close: jest.fn(),
    };
    global.EventSource = jest.fn(() => mockEventSource) as any;

    const chunks: string[] = [];
    await streamChatMessage(
      { message: 'テスト' },
      (chunk) => chunks.push(chunk)
    );

    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

## スナップショットテスト

```typescript
import { render } from '@testing-library/react';
import { ChatContainer } from '@/components/ChatContainer';

describe('ChatContainer snapshot', () => {
  it('初期状態のスナップショットが一致する', () => {
    const { container } = render(<ChatContainer />);
    expect(container).toMatchSnapshot();
  });
});
```

## E2Eテスト (Playwright)

```bash
# Playwright インストール
npx playwright install

# E2Eテスト実行
npm run e2e

# ヘッドレスモード
npm run e2e:headless
```

### E2Eテスト例

```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('チャット送信と応答受信', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // メッセージ入力
  await page.fill('textarea[placeholder="メッセージを入力..."]', 'バルーンカテーテルについて教えて');

  // 送信ボタンクリック
  await page.click('button[type="submit"]');

  // 応答待機
  await page.waitForSelector('text=/バルーン/');

  // 応答が表示されることを確認
  const response = await page.textContent('.message-response');
  expect(response).toBeTruthy();
});

test('テーマ切替が動作する', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // テーマ切替ボタンクリック
  await page.click('[title*="ダークモード"]');

  // darkクラスが追加されることを確認
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/);
});
```

## カバレッジ確認

```bash
# カバレッジレポート生成
npm test -- --coverage

# レポート確認
open coverage/lcov-report/index.html
```

**目標カバレッジ**:
- Components: 80%以上
- Hooks: 90%以上
- Utilities: 90%以上

## CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/test-frontend.yml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## トラブルシューティング

### jsdom エラー

```bash
# jest.setup.js に追加
global.EventSource = class EventSource {
  constructor() {}
  addEventListener() {}
  close() {}
};
```

### Next.js import エラー

```javascript
// jest.config.js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### localStorage エラー

```javascript
// jest.setup.js
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
```

---

**最終更新**: 2025-10-27
