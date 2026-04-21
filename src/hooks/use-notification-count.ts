"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";

export function useNotificationCount() {
  const { accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // silently fail — sidebar badge is non-critical
      }
    }

    fetchCount();
    return () => { cancelled = true; };
  }, [accessToken]);

  return unreadCount;
}
