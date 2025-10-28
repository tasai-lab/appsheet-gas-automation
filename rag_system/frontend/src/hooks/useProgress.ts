import { useState, useEffect, useRef } from 'react';

/**
 * useProgress Hook設定
 */
interface UseProgressOptions {
  initialProgress?: number;
  autoIncrement?: boolean;  // 自動進捗更新（ストリーミング中断時）
  incrementInterval?: number;  // 自動進捗更新間隔（ms）
}

/**
 * useProgress Hook戻り値
 */
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

/**
 * 進捗管理用カスタムHook
 *
 * SSEストリーミングから進捗情報を抽出し、状態管理を行います。
 *
 * @param options - Hook設定
 * @returns 進捗状態と更新関数
 *
 * @example
 * ```tsx
 * const { progress, status, setStatus, setProgress, reset } = useProgress({
 *   autoIncrement: true,
 *   incrementInterval: 1000
 * });
 * ```
 */
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

  /**
   * 進捗状態をリセット
   */
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
