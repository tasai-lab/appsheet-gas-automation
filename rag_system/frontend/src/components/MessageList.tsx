"use client";

import { useEffect, useRef } from "react";
import Message from "./Message";
import type { ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">メッセージがありません</p>
            <p className="text-sm">質問を入力して開始してください</p>
          </div>
        </div>
      ) : (
        messages.map((msg, index) => <Message key={index} message={msg} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
