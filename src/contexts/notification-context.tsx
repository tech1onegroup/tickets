"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/hooks/use-auth";

interface NotificationContextType {
  unreadCount: number | null;
  /** Increments every time the server reports a change — watch this to refetch data */
  lastUpdated: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: null,
  lastUpdated: 0,
  markAsRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  // Keep a ref so callbacks don't go stale when token rotates
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const applyCount = (count: number) => {
    setUnreadCount(count);
    setLastUpdated(Date.now());
  };

  // Fetch current unread count from REST (used by polling + initial load)
  const fetchCount = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        applyCount(data.unreadCount);
      }
    } catch {
      // network error — will retry on next poll
    }
  }, []);

  // Initial fetch + polling every 15 s (reliable fallback if SSE drops)
  useEffect(() => {
    if (!accessToken) return;
    fetchCount();
    const interval = setInterval(fetchCount, 15_000);
    return () => clearInterval(interval);
  }, [accessToken, fetchCount]);

  // SSE for instant updates on top of polling
  useEffect(() => {
    if (!accessToken) return;

    const es = new EventSource(
      `/api/notifications/stream?token=${accessToken}`
    );

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "unread_count") {
          applyCount(data.unreadCount);
        }
      } catch {}
    };

    // onerror fires on disconnect — EventSource auto-reconnects; polling handles the gap
    return () => es.close();
  }, [accessToken]);

  const markAsRead = useCallback(async (id: string) => {
    const token = tokenRef.current;
    if (!token) return;
    setUnreadCount((c) => (c !== null ? Math.max(0, c - 1) : c));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationId: id }),
    });
  }, []);

  const markAllRead = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setUnreadCount(0);
    setLastUpdated(Date.now());
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ markAllRead: true }),
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, lastUpdated, markAsRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
