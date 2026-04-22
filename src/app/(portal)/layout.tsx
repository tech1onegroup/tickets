"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalSidebar } from "@/components/shared/portal-sidebar";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { NotificationProvider } from "@/contexts/notification-context";
import { Building2, Menu, X } from "lucide-react";
import { isAllowedPath } from "@/lib/features";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    if (!isAllowedPath("CUSTOMER", pathname)) {
      router.replace("/tickets");
    }
  }, [user, pathname, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [children]);

  // Show spinner until auth is fully resolved AND accessToken is in sync.
  // This prevents pages from mounting with accessToken=null and missing their
  // initial data fetch (the effect fires once with null then never re-runs).
  if (isLoading || (user && !accessToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <NotificationProvider>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block">
        <PortalSidebar />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <PortalSidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
              <Building2 className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">ONE Group</span>
          </div>
        </div>

        <main className="flex-1 p-4 md:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}
