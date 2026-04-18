import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMessages } from '../services';
import { useAuth } from './AuthContext';

const CHAT_POLL_INTERVAL_MS = 10000;
const ChatContext = createContext(null);

function safeConversationArray(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

export function ChatProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const payload = await getMessages();
      const conversations = safeConversationArray(payload);
      const metaCount = Number(payload?.meta?.total_unread);

      const totalUnread = Number.isFinite(metaCount)
        ? Math.max(0, metaCount)
        : conversations.reduce((sum, item) => sum + Number(item?.unread_count || 0), 0);

      setUnreadCount(totalUnread);
      return totalUnread;
    } catch {
      return unreadCount;
    }
  }, [isAuthenticated, unreadCount]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return undefined;
    }

    refreshUnreadCount();
    const intervalId = setInterval(() => {
      refreshUnreadCount();
    }, CHAT_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, refreshUnreadCount]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      setUnreadCount,
    }),
    [refreshUnreadCount, unreadCount]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used inside ChatProvider');
  }

  return context;
}
