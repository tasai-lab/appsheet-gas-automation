# Frontend TODO リスト

**最終更新**: 2025-10-28
**現行バージョン**: V2
**次期バージョン**: V3（2025-11-26 〜 2025-12-03）

---

## 🚨 優先度: 高（緊急）

### 1. ✅ ビルドエラー修正（完了）

**ステータス**: ✅ 完了（2025-10-28）

**問題**:
- `ChatSessionItem`型に`title`と`preview`プロパティが存在しない
- Sidebar.tsxでビルドエラー発生

**解決策**:
- [x] api.tsの型定義に`title`と`preview`を追加
- [x] Sidebar.tsxでフォールバック値を設定

**変更ファイル**:
- `src/lib/api.ts`: ChatSessionItem型にtitle/preview追加
- `src/components/Sidebar.tsx`: フォールバック値設定

---

### 1.5 ✅ 画像最適化（完了）

**ステータス**: ✅ 完了（2025-10-28）

**問題**:
- Sidebar.tsxで`<img>`タグを使用（2箇所）
- Next.js警告: `@next/next/no-img-element`
- LCPが遅くなる可能性

**解決策**:
- [x] `<img>` → `<Image>` (Next.js Image) に置き換え
- [x] width/height属性を明示的に指定
- [x] ロゴ画像に`priority`属性を追加

**変更ファイル**:
- `src/components/Sidebar.tsx`: line 108, 196

**効果**:
- ✅ ビルド警告解消
- ✅ LCP改善
- ✅ 帯域幅最適化

---

## 🔴 優先度: 高（V2改善）

### 2. 画像最適化（Next.js Image）

**ステータス**: ⚪ 未対応

**問題**:
- Sidebar.tsxで`<img>`タグを使用（2箇所）
- LCPが遅くなる可能性
- 帯域幅の無駄

**解決策**:
```typescript
// ❌ 現在
<img src="/f-assistant.png" alt="F Assistant" className="..." />

// ✅ 修正後
import Image from 'next/image';
<Image src="/f-assistant.png" alt="F Assistant" width={64} height={64} className="..." />
```

**変更ファイル**:
- `src/components/Sidebar.tsx`: line 108, 196

**優先度**: 🟡 Medium
**工数**: 30分

### 3. セッション履歴の実装改善

**ステータス**: ⚪ 未対応

**問題**:
- セッション一覧が取得できているが、`title`と`preview`がBackendから返されていない
- 現在はフォールバック値で対応しているが、UXが悪い

**解決策**:
- Backend APIで`title`と`preview`を生成して返す
  - title: 最初のユーザーメッセージから生成
  - preview: 最後のメッセージの最初の50文字

**関連タスク**:
- Backend: chat_sessions テーブルにtitleカラム追加（V3で対応予定）
- Backend: セッション一覧APIでpreviewを生成

**優先度**: 🔴 High
**工数**: Backend 2時間、Frontend 30分

### 4. エラーハンドリングの強化

**ステータス**: ⚪ 未対応

**問題**:
- API呼び出しエラー時のユーザーフィードバックが不十分
- ネットワークエラー時の再試行機能がない

**解決策**:
```typescript
// エラートースト表示
import { useToast } from '@/hooks/useToast';

const { showToast } = useToast();

try {
  const result = await apiCall();
} catch (error) {
  showToast({
    type: 'error',
    message: 'エラーが発生しました',
    description: error.message
  });
}
```

**変更ファイル**:
- `src/hooks/useToast.ts`: 新規作成
- `src/components/Toast.tsx`: 新規作成
- `src/components/ChatContainer.tsx`: エラーハンドリング改善

**優先度**: 🟡 Medium
**工数**: 2時間

---

## 🟡 優先度: 中（V2改善）

### 5. ローディング状態の改善

**ステータス**: ⚪ 未対応

**問題**:
- セッション読み込み中のローディング表示がない
- 利用者一覧読み込み中のローディング表示が簡素

**解決策**:
- Skeletonローダーの実装
- スムーズなアニメーション

**変更ファイル**:
- `src/components/SkeletonLoader.tsx`: 新規作成
- `src/components/Sidebar.tsx`: Skeleton統合
- `src/components/NewChatModal.tsx`: Skeleton統合

**優先度**: 🟡 Medium
**工数**: 1.5時間

### 6. アクセシビリティ改善

**ステータス**: ⚪ 未対応

**問題**:
- ARIA属性が不足
- キーボードナビゲーションが不完全

**解決策**:
- ARIA属性追加（aria-label, aria-describedby, role）
- フォーカス管理の改善
- Tab順序の最適化

**変更ファイル**:
- 全コンポーネント

**優先度**: 🟢 Low
**工数**: 3時間

---

## 🚀 優先度: 高（V3実装）

### 7. ✅ V3: 進捗バーコンポーネント実装（完了）

**ステータス**: ✅ 完了（2025-10-28）
**フェーズ**: Phase 3 - Task 3.1（前倒し完了）
**期間**: 2025-10-28（1日で完了）

**実装内容**:
- [x] ProgressBar.tsx 作成（ステージインジケーター、進捗バー、経過時間表示）
- [x] useProgress.ts 作成（進捗状態管理、経過時間自動更新）
- [x] ChatContainer.tsx更新（ProgressBar統合、旧進捗表示を置き換え）
- [x] SSEステータス同期（optimizing, searching, reranking, generating）
- [x] ステージ別進捗更新（10% → 30% → 60% → 80% → 100%）
- [x] スムーズなアニメーション（Tailwind transition）
- [x] レスポンシブ対応（Mobile: 90%、Tablet/Desktop: 400-450px）
- [x] ダークモード対応

**実装ファイル**:
```
✅ frontend/src/components/ProgressBar.tsx          # 新規作成完了（218行）
✅ frontend/src/hooks/useProgress.ts                # 新規作成完了（112行）
✅ frontend/src/components/ChatContainer.tsx        # 更新完了（進捗バー統合）
```

**技術仕様**:
- Stage コンポーネント: アイコン、ラベル、アクティブ/完了状態
- useProgress Hook: 自動経過時間更新、進捗リセット
- 進捗マップ: `{ optimizing: 10, searching: 30, reranking: 60, generating: 80 }`
- 完了後1秒でフェードアウト

**設計**:
```typescript
interface ProgressBarProps {
  status: 'optimizing' | 'searching' | 'reranking' | 'generating' | null;
  progress: number;  // 0-100
  message?: string;
  elapsedTime?: number;  // ミリ秒
  onCancel?: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  status,
  progress,
  message,
  elapsedTime,
  onCancel
}) => {
  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4">
      {/* ステータス表示 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{message || '処理中...'}</span>
        <span className="text-sm text-gray-500">{progress}%</span>
      </div>

      {/* 進捗バー */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ステージインジケーター */}
      <div className="flex items-center gap-2 mt-3">
        <ProgressStage label="最適化" active={status === 'optimizing'} done={['searching', 'reranking', 'generating'].includes(status || '')} />
        <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
        <ProgressStage label="検索" active={status === 'searching'} done={['reranking', 'generating'].includes(status || '')} />
        <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
        <ProgressStage label="最適化" active={status === 'reranking'} done={status === 'generating'} />
        <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
        <ProgressStage label="生成" active={status === 'generating'} done={false} />
      </div>

      {/* 経過時間と中止ボタン */}
      {elapsedTime && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            経過時間: {(elapsedTime / 1000).toFixed(1)}秒
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              中止
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

**参考ドキュメント**:
- [docs/V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md#71-進捗バーの同期)
- [docs/V3_TASKS.md](../docs/V3_TASKS.md#task-31-進捗バー実装2日)

**優先度**: 🔴 High（V3）
**実績工数**: 1日（予定2日 → 50%短縮）

**効果**:
- ✅ V3進捗バーの早期実装完了
- ✅ ユーザーへのリアルタイムフィードバック
- ✅ ビルドサイズ増加: +5.4KB（52.5KB → 57.9KB）

### 8. V3: API統合（Backend V3エンドポイント）

**ステータス**: ⚪ 未開始
**フェーズ**: Phase 3 - Task 3.2
**期間**: 2025-11-28 〜 2025-12-01（3日間）

**要件**:
- Backend V3 API エンドポイント統合
- SSEストリーミング受信処理（新ステータス対応）
  - `optimizing`: プロンプト最適化中
  - `searching`: ベクトル検索中
  - `reranking`: リランキング中
  - `generating`: 回答生成中

**実装ファイル**:
```
frontend/src/lib/api_v3.ts                # 新規作成（V3 API）
frontend/src/hooks/useChatV3.ts           # 新規作成（V3 Hook）
frontend/src/types/api_v3.ts              # 新規作成（V3型定義）
frontend/tests/api_v3.test.ts             # 新規作成（テスト）
```

**V3 APIエンドポイント**:
```
POST /chat/stream
  - 新ステータス: optimizing, searching, reranking, generating
  - 最適化プロンプトをmetadataで返す
```

**優先度**: 🔴 High（V3）
**工数**: 3日

### 9. V3: UI/UX調整

**ステータス**: ⚪ 未開始
**フェーズ**: Phase 3 - Task 3.3
**期間**: 2025-12-01 〜 2025-12-03（2日間）

**要件**:
- レイアウト調整（進捗バー配置）
- レスポンシブ対応確認（Mobile、Tablet、Desktop）
- アクセシビリティ改善（WCAG 2.1 AA準拠）
- ダークモード対応
- ユーザーフィードバック収集

**優先度**: 🟡 Medium（V3）
**工数**: 2日

---

## 🟢 優先度: 低（Nice-to-have）

### 10. パフォーマンス最適化

**ステータス**: ⚪ 未対応

**改善案**:
- React.memoの活用
- useCallbackの最適化
- Code Splittingの改善
- Lazy Loadingの導入

**優先度**: 🟢 Low
**工数**: 4時間

### 11. テストカバレッジ向上

**ステータス**: ⚪ 未対応

**現状**: テストがほとんど存在しない

**目標**:
- 単体テストカバレッジ > 80%
- 統合テストの追加
- E2Eテストの追加（Cypress or Playwright）

**優先度**: 🟢 Low
**工数**: 1週間

---

## 📊 サマリー

### タスク統計

| 優先度 | V2改善 | V3実装 | 合計 |
|-------|-------|-------|------|
| 🔴 High | 3 | 3 | 6 |
| 🟡 Medium | 2 | 1 | 3 |
| 🟢 Low | 2 | 0 | 2 |
| **合計** | **7** | **4** | **11** |

### 完了状況

- ✅ 完了: 3タスク（27%）
  - ビルドエラー修正
  - 画像最適化
  - V3進捗バー実装
- 🟡 進行中: 0タスク（0%）
- ⚪ 未開始: 8タスク（73%）

### 推定工数

- **V2改善**: 約11.5時間（1.5日 → 0.5時間完了済み）
- **V3実装**: 約6日（7日 → 1日完了済み）
- **残り**: 約7.5日
- **合計**: 約8.5日

---

## 🎯 次のアクションアイテム

### 今週（Phase 0: 準備） - ✅ 完了

1. ✅ ビルドエラー修正（完了 - 2025-10-28午前）
2. ✅ 画像最適化（Next.js Image）（完了 - 2025-10-28午後）
3. ⏸️ セッション履歴の実装改善（Backend連携待ち - Phase 1以降）
4. ✅ V3進捗バー実装（完了 - 2025-10-28午後、当初は11/26予定）

### 来週（Phase 1: データベース移行）

- Backendのデータベース移行を待機
- V3進捗バーの設計・モックアップ作成

### Phase 3（2025-11-26 〜 2025-12-03）

- V3進捗バー実装
- V3 API統合
- V3 UI/UX調整

---

## 📚 関連ドキュメント

- **[frontend/.claude/CLAUDE.md](../.claude/CLAUDE.md)** - Frontend開発ガイド
- **[docs/V3_TASKS.md](../docs/V3_TASKS.md)** - V3タスクバックログ
- **[docs/V3_ARCHITECTURE.md](../docs/V3_ARCHITECTURE.md)** - V3アーキテクチャ設計書

---

**作成者**: Claude (AI Assistant)
**最終更新**: 2025-10-28
**次回レビュー**: 毎週月曜日
