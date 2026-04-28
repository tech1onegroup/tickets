"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { AuthContext, AuthUser } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return true;
      }
    } catch {
      // Token invalid
    }
    return false;
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    async function restore() {
      const stored = localStorage.getItem("access_token");
      if (stored) {
        const ok = await fetchUser(stored);
        if (ok) {
          setAccessToken(stored);
        } else {
          // Try refresh
          try {
            const res = await fetch("/api/auth/refresh", { method: "POST" });
            if (res.ok) {
              const { accessToken: newToken } = await res.json();
              const refreshOk = await fetchUser(newToken);
              if (refreshOk) {
                localStorage.setItem("access_token", newToken);
                setAccessToken(newToken);
              } else {
                localStorage.removeItem("access_token");
              }
            } else {
              localStorage.removeItem("access_token");
            }
          } catch {
            localStorage.removeItem("access_token");
          }
        }
      }
      setIsLoading(false);
    }
    restore();
  }, [fetchUser]);

  const login = async (phone: string) => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { success: true };
  };

  const loginWithPhone = async (phone: string) => {
    const res = await fetch("/api/auth/phone-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem("access_token", data.accessToken);
    setAccessToken(data.accessToken);
    await fetchUser(data.accessToken);
    return true;
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem("access_token", data.accessToken);
    setAccessToken(data.accessToken);

    // Fetch full user profile (with bookings) instead of using minimal verify response
    await fetchUser(data.accessToken);
    return true;
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setAccessToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, login, loginWithPhone, verifyOtp, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}
