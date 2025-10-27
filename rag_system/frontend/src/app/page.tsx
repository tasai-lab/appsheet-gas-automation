/**
 * ホームページ (Protected)
 *
 * 認証済みユーザーのみアクセス可能なチャット画面
 */

'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ChatContainer from "@/components/ChatContainer";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 認証チェック: ログインしていない場合は/loginにリダイレクト
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 未認証の場合は何も表示しない（リダイレクト待ち）
  if (!user) {
    return null;
  }

  // 認証済み: チャット画面を表示
  return <ChatContainer />;
}
