"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTicketsOnly } from "@/lib/features";

export default function GoogleCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = params.get("token");

    if (!token) {
      router.replace("/login?googleError=missing_token");
      return;
    }

    localStorage.setItem("access_token", token);

    // Fetch the user so we can redirect to the role-appropriate page
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (!me) {
          router.replace("/login?googleError=session_failed");
          return;
        }
        const isAdmin = me.role === "ADMIN" || me.role === "SUPER_ADMIN";
        if (isTicketsOnly()) {
          window.location.href = isAdmin ? "/admin/tickets" : "/tickets";
        } else {
          window.location.href = isAdmin ? "/admin/dashboard" : "/dashboard";
        }
      })
      .catch(() => router.replace("/login?googleError=session_failed"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
