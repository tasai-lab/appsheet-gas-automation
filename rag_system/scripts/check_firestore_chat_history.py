"""
Firestoreチャット履歴を確認するスクリプト
"""
import asyncio
from google.cloud import firestore
from datetime import datetime, timedelta

async def check_chat_history():
    """Firestoreのチャット履歴を確認"""
    db = firestore.AsyncClient(project="fractal-ecosystem")

    print("=" * 80)
    print("Firestoreチャット履歴確認")
    print("=" * 80)

    # 1. chat_sessionsコレクションを確認
    print("\n【1】chat_sessionsコレクション")
    print("-" * 80)

    sessions_ref = db.collection('chat_sessions')
    sessions = []
    async for doc in sessions_ref.limit(10).stream():
        sessions.append(doc)
        data = doc.to_dict()
        print(f"\nSession ID: {doc.id}")
        print(f"  User ID: {data.get('user_id')}")
        print(f"  Created: {data.get('created_at')}")
        print(f"  Updated: {data.get('updated_at')}")
        print(f"  Message Count: {data.get('message_count', 0)}")

    if not sessions:
        print("❌ セッションが1件も見つかりません")
        print("\n原因の可能性:")
        print("  1. Backend が Firestore にデータを保存していない")
        print("  2. USE_FIRESTORE_CHAT_HISTORY 環境変数が False")
        print("  3. 認証エラーでセッション作成に失敗している")
        return

    print(f"\n✅ {len(sessions)} 件のセッションが見つかりました")

    # 2. 最新セッションのメッセージを確認
    if sessions:
        latest_session = sessions[0]
        session_id = latest_session.id

        print(f"\n【2】最新セッション ({session_id}) のメッセージ")
        print("-" * 80)

        messages_ref = db.collection('chat_sessions').document(session_id).collection('messages')
        messages = []
        async for msg_doc in messages_ref.order_by('timestamp').stream():
            messages.append(msg_doc)
            msg_data = msg_doc.to_dict()
            print(f"\n  Message ID: {msg_doc.id}")
            print(f"    Role: {msg_data.get('role')}")
            print(f"    Content (first 100 chars): {msg_data.get('content', '')[:100]}")
            print(f"    Timestamp: {msg_data.get('timestamp')}")

        if not messages:
            print("  ❌ メッセージが1件も見つかりません")
            print("\n  原因の可能性:")
            print("    1. save_user_message() または save_assistant_message() が実行されていない")
            print("    2. Firestoreへの書き込み権限がない")
        else:
            print(f"\n  ✅ {len(messages)} 件のメッセージが見つかりました")

    # 3. 最近24時間のセッション数を確認
    print(f"\n【3】最近24時間のセッション数")
    print("-" * 80)

    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_sessions = []
    async for doc in sessions_ref.where('created_at', '>=', yesterday).stream():
        recent_sessions.append(doc)

    print(f"最近24時間: {len(recent_sessions)} 件")

    # 4. Frontend用APIエンドポイントの動作確認
    print(f"\n【4】フロントエンド履歴取得API確認")
    print("-" * 80)
    print("Frontendは以下のAPIエンドポイントを実装する必要があります:")
    print("  GET /chat/sessions?user_id={user_id}")
    print("  GET /chat/sessions/{session_id}/messages")
    print("\n現在の実装状況を確認してください。")

if __name__ == "__main__":
    asyncio.run(check_chat_history())
