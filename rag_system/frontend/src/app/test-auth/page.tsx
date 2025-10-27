/**
 * Firebase認証テストページ
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function TestAuthPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Firebase設定を確認
    setConfig({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '設定済み' : '未設定',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }, []);

  const handleTestLogin = async () => {
    try {
      setError(null);
      console.log('🔑 ログインテスト開始...');
      await signInWithGoogle();
      console.log('✅ ログイン成功！');
    } catch (err: any) {
      console.error('❌ ログインエラー:', err);
      setError(err.message || err.toString());
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Firebase認証テスト</h1>

        {/* 設定確認 */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">環境変数確認</h2>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>

        {/* 認証状態 */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">認証状態</h2>
          {loading ? (
            <p>読み込み中...</p>
          ) : user ? (
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✅ ログイン済み</p>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm">
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Name:</strong> {user.displayName}</p>
                <p><strong>UID:</strong> {user.uid}</p>
              </div>
            </div>
          ) : (
            <p className="text-orange-600">未ログイン</p>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded">
            <h3 className="font-semibold mb-2">エラー:</h3>
            <pre className="text-sm overflow-auto">{error}</pre>
          </div>
        )}

        {/* テストボタン */}
        <div className="space-y-4">
          <button
            onClick={handleTestLogin}
            disabled={loading || !!user}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {user ? 'ログイン済み' : 'Googleログインをテスト'}
          </button>

          <a
            href="/"
            className="block text-center py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ホームに戻る
          </a>
        </div>

        {/* デバッグ情報 */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">デバッグ情報</h2>
          <div className="text-sm space-y-2">
            <p><strong>ブラウザコンソールを確認してください</strong></p>
            <p>- F12キーを押してデベロッパーツールを開く</p>
            <p>- Consoleタブでエラーを確認</p>
            <p>- Networkタブで Firebase API呼び出しを確認</p>
          </div>
        </div>
      </div>
    </div>
  );
}
