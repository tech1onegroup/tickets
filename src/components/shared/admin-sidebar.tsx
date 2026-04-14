"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isTicketsOnly } from "@/lib/features";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  FileUp,
  Building2,
  CreditCard,
  HardHat,
  FileText,
  LogOut,
  Settings,
  BarChart3,
  MessageSquare,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/bookings/import", label: "Import Bookings", icon: FileUp },
      { href: "/admin/projects", label: "Projects", icon: Building2 },
      { href: "/admin/community", label: "Community", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/tickets", label: "Tickets", icon: MessageSquare },
      { href: "/admin/construction", label: "Construction", icon: HardHat },
      { href: "/admin/documents", label: "Documents", icon: FileText },
      { href: "/admin/possession", label: "Possession", icon: ClipboardCheck },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const ticketsOnlyAllowed = new Set(["/admin/tickets", "/admin/customers"]);
  const visibleGroups = isTicketsOnly()
    ? navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            ticketsOnlyAllowed.has(item.href)
          ),
        }))
        .filter((group) => group.items.length > 0)
    : navGroups;

  return (
    <aside className="flex flex-col w-64 h-screen sticky top-0 bg-[#1a1a1c] text-white overflow-y-auto">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center font-bold text-sm text-primary-foreground">
            OG
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ONE Group</h1>
            <Badge
              variant="secondary"
              className="mt-0.5 bg-primary/20 text-accent border-primary/30 text-[10px] px-1.5 py-0 font-medium"
            >
              Admin Panel
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 relative",
                    isActive(item.href)
                      ? "bg-white/10 text-white border-l-2 border-primary pl-[10px]"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive(item.href) ? "text-accent" : ""
                    )}
                  />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-4 h-px bg-white/10" />

      {/* Admin info */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {(user?.name || "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white/80">
              {user?.name || "Admin"}
            </p>
            <p className="text-[11px] text-white/40">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-white/50 hover:text-white hover:bg-white/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
