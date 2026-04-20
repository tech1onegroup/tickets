"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Phone,
  User as UserIcon,
  XCircle,
  FileText,
  Search,
  Lock,
} from "lucide-react";
import {
  AttachmentPicker,
  appendAttachmentsToFormData,
} from "@/components/shared/attachment-picker";

interface TicketRow {
  id: string;
  ticketRef: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  customerName: string;
  customerPhone: string;
  assignedTo: string | null;
  assignedToLabel: string | null;
  createdAt: string;
  lastMessageAt: string;
  lastMessageFromCustomer: boolean;
  isStale: boolean;
}

interface TicketDetail {
  id: string;
  ticketRef: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  messages: Array<{
    id: string;
    senderId: string;
    message: string;
    isAdmin: boolean;
    isInternal: boolean;
    attachments: Array<{
      id: string;
      url: string;
      name: string;
      type: string;
      size: number;
    }>;
    createdAt: string;
  }>;
}

interface AdminUser {
  id: string;
  phone: string;
  email: string | null;
  label: string;
}

interface Counts {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  total: number;
  myOpen: number;
  unassigned: number;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  OPEN: { label: "Open", color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  RESOLVED: { label: "Resolved", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-50 text-blue-600",
  HIGH: "bg-orange-50 text-orange-600",
  URGENT: "bg-red-100 text-red-700",
};

const categoryOptions = [
  { value: "PAYMENT_DISPUTE", label: "Payment Dispute" },
  { value: "NAME_CHANGE", label: "Name Change" },
  { value: "ADDRESS_UPDATE", label: "Address Update" },
  { value: "CONSTRUCTION_QUERY", label: "Construction Query" },
  { value: "DOCUMENT_REQUEST", label: "Document Request" },
  { value: "GENERAL", label: "General" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(
  categoryOptions.map((c) => [c.value, c.label])
);

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function AttachmentBubble({
  url,
  name,
  type,
  size,
  invert,
}: {
  url: string;
  name: string;
  type: string | null;
  size: number | null;
  invert: boolean;
}) {
  const isImage = (type || "").startsWith("image/");
  const sizeKb = size ? `${(size / 1024).toFixed(0)} KB` : "";
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-64 rounded-md border border-white/10" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        invert
          ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
      }`}
    >
      <FileText className="h-4 w-4" />
      <span className="flex-1 truncate">{name}</span>
      {sizeKb && <span className={invert ? "text-indigo-200" : "text-gray-500"}>{sizeKb}</span>}
    </a>
  );
}

export default function AdminTicketsPage() {
  return (
    <Suspense>
      <AdminTicketsContent />
    </Suspense>
  );
}

function AdminTicketsContent() {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    total: 0,
    myOpen: 0,
    unassigned: 0,
  });
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Read current filters from URL
  const filters = useMemo(
    () => ({
      q: searchParams.get("q") || "",
      status: searchParams.get("status") || "ALL",
      category: searchParams.get("category") || "ALL",
      priority: searchParams.get("priority") || "ALL",
      assignedTo: searchParams.get("assignedTo") || "",
      unassigned: searchParams.get("unassigned") === "true",
      view: searchParams.get("view") || "",
    }),
    [searchParams]
  );

  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => setSearchInput(filters.q), [filters.q]);

  // Debounce search into URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.q) {
        updateUrl({ q: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const updateUrl = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "" || v === "ALL") params.delete(k);
        else params.set(k, v);
      });
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  const fetchTickets = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.category !== "ALL") params.set("category", filters.category);
      if (filters.priority !== "ALL") params.set("priority", filters.priority);
      if (filters.unassigned) params.set("unassigned", "true");
      else if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
      const res = await fetch(`/api/admin/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { admins: [] }))
      .then((d) => setAdmins(d.admins || []))
      .catch(() => setAdmins([]));
  }, [accessToken]);

  const openTicket = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const res = await fetch(`/api/admin/tickets?id=${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedTicket(data.ticket);
          setSheetOpen(true);
          setReply("");
          setAttachments([]);
          setIsInternal(false);
          setReplyError(null);
        }
      } catch (err) {
        console.error("Failed to open ticket:", err);
      }
    },
    [accessToken]
  );

  const handleReply = async () => {
    if (!accessToken || !selectedTicket) return;
    if (!reply.trim() && attachments.length === 0) return;
    setSending(true);
    setReplyError(null);
    try {
      const fd = new FormData();
      fd.append("ticketId", selectedTicket.id);
      fd.append("reply", reply.trim());
      if (isInternal) fd.append("isInternal", "true");
      appendAttachmentsToFormData(fd, attachments);
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (res.ok) {
        setReply("");
        setAttachments([]);
        setIsInternal(false);
        await openTicket(selectedTicket.id);
        await fetchTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        setReplyError(data.error || "Failed to send reply");
      }
    } catch (err) {
      console.error("Reply failed:", err);
      setReplyError("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const patchTicket = useCallback(
    async (body: Record<string, unknown>) => {
      if (!accessToken) return;
      try {
        await fetch("/api/admin/tickets", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });
        const sid = selectedTicket?.id;
        if (sid && sid === body.ticketId) await openTicket(sid);
        await fetchTickets();
      } catch (err) {
        console.error("Update failed:", err);
      }
    },
    [accessToken, selectedTicket, openTicket, fetchTickets]
  );

  const applyView = (view: string) => {
    const patch: Record<string, string | null | undefined> = {
      view,
      status: undefined,
      assignedTo: undefined,
      unassigned: undefined,
      priority: undefined,
    };
    if (view === "my_open") {
      patch.assignedTo = "me";
      patch.status = "OPEN";
    } else if (view === "unassigned") {
      patch.unassigned = "true";
    } else if (view === "urgent") {
      patch.priority = "URGENT";
    } else if (view === "all") {
      patch.view = undefined;
    }
    updateUrl(patch);
  };

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const views = [
    { id: "all", label: "All", count: counts.total },
    { id: "my_open", label: "My open", count: counts.myOpen },
    { id: "unassigned", label: "Unassigned", count: counts.unassigned },
    { id: "urgent", label: "Urgent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Support Tickets
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage and respond to customer support requests
        </p>
      </div>

      {/* Saved view chips */}
      <div className="flex flex-wrap gap-2">
        {views.map((v) => {
          const active =
            (v.id === "all" && !filters.view) || filters.view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => applyView(v.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {v.label}
              {typeof v.count === "number" && (
                <span
                  className={`text-xs ${
                    active ? "text-indigo-100" : "text-gray-500"
                  }`}
                >
                  {v.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search ref, subject, customer, phone"
            className="pl-9"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(v) => updateUrl({ status: v, view: undefined })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.category}
          onValueChange={(v) => updateUrl({ category: v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.priority}
          onValueChange={(v) => updateUrl({ priority: v, view: undefined })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={
            filters.unassigned
              ? "__unassigned__"
              : filters.assignedTo || "__all__"
          }
          onValueChange={(v) => {
            if (v === "__all__") updateUrl({ assignedTo: undefined, unassigned: undefined, view: undefined });
            else if (v === "__unassigned__") updateUrl({ assignedTo: undefined, unassigned: "true", view: undefined });
            else if (v === "me") updateUrl({ assignedTo: "me", unassigned: undefined, view: undefined });
            else updateUrl({ assignedTo: v, unassigned: undefined, view: undefined });
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(v: unknown) => {
                if (v === "__all__" || v == null) return "All assignees";
                if (v === "__unassigned__") return "Unassigned";
                if (v === "me") return "Assigned to me";
                return admins.find((a) => a.id === v)?.label ?? "Assignee";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All assignees</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm">No tickets match these filters.</p>
            </div>
          ) : (
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => {
                  const sc = statusConfig[t.status];
                  const StatusIcon = sc?.icon || AlertCircle;
                  const waiting =
                    t.lastMessageFromCustomer &&
                    t.status !== "CLOSED" &&
                    t.status !== "RESOLVED";
                  const ageStr = relativeAge(t.lastMessageAt);
                  const ageClass =
                    t.isStale && t.status !== "CLOSED" && t.status !== "RESOLVED"
                      ? "text-red-600 font-medium"
                      : "text-gray-500";
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer group hover:bg-gray-50"
                      onClick={() => openTicket(t.id)}
                    >
                      <TableCell>
                        {waiting && (
                          <span
                            title="Customer is waiting for a reply"
                            className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {t.ticketRef}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[260px] truncate">
                        {t.subject}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{t.customerName}</span>
                          <span className="text-xs text-gray-500">
                            +91 {t.customerPhone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {categoryLabels[t.category] || t.category}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc?.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {sc?.label || t.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            priorityColors[t.priority] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {t.assignedToLabel || (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs ${ageClass}`}>
                        {ageStr}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          {t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                              onClick={() =>
                                patchTicket({ ticketId: t.id, status: "RESOLVED" })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Resolve
                            </Button>
                          )}
                          {t.status !== "CLOSED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-gray-600 hover:bg-gray-100"
                              onClick={() =>
                                patchTicket({ ticketId: t.id, status: "CLOSED" })
                              }
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Side sheet detail */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto flex flex-col !p-0"
        >
          {selectedTicket && (
            <>
              <SheetHeader className="pr-12 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">
                    {selectedTicket.ticketRef}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusConfig[selectedTicket.status]?.color
                    }`}
                  >
                    {statusConfig[selectedTicket.status]?.label || selectedTicket.status}
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 flex flex-col gap-4 p-4 min-h-0">
                <div>
                  <h3 className="text-base font-semibold">
                    {selectedTicket.subject}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" />
                      {selectedTicket.customerName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      +91 {selectedTicket.customerPhone}
                    </span>
                    <span>·</span>
                    <span>{categoryLabels[selectedTicket.category] || selectedTicket.category}</span>
                  </div>
                </div>

                {/* Status actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.status !== "IN_PROGRESS" &&
                    selectedTicket.status !== "RESOLVED" &&
                    selectedTicket.status !== "CLOSED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() =>
                          patchTicket({
                            ticketId: selectedTicket.id,
                            status: "IN_PROGRESS",
                          })
                        }
                      >
                        <Clock className="h-3 w-3 mr-1" /> In Progress
                      </Button>
                    )}
                  {selectedTicket.status !== "RESOLVED" &&
                    selectedTicket.status !== "CLOSED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() =>
                          patchTicket({
                            ticketId: selectedTicket.id,
                            status: "RESOLVED",
                          })
                        }
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    )}
                  {selectedTicket.status !== "CLOSED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                      onClick={() =>
                        patchTicket({
                          ticketId: selectedTicket.id,
                          status: "CLOSED",
                        })
                      }
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Close
                    </Button>
                  )}
                </div>

                {/* Priority + Assignee */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Priority
                    </label>
                    <Select
                      value={selectedTicket.priority}
                      onValueChange={(v) =>
                        v && patchTicket({ ticketId: selectedTicket.id, priority: v })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Assignee
                    </label>
                    <Select
                      value={selectedTicket.assignedTo || "__none__"}
                      onValueChange={(v) =>
                        patchTicket({
                          ticketId: selectedTicket.id,
                          assignedTo: v === "__none__" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm mt-1 w-full">
                        <SelectValue>
                          {(v: unknown) => {
                            if (!v || v === "__none__") return "Unassigned";
                            const label =
                              admins.find((a) => a.id === v)?.label ?? String(v);
                            return v === user?.id ? `${label} (me)` : label;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {user?.id && !admins.some((a) => a.id === user.id) && (
                          <SelectItem value={user.id}>Me</SelectItem>
                        )}
                        {admins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.id === user?.id ? `${a.label} (me)` : a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 rounded-lg border p-4 bg-white">
                  {selectedTicket.messages.map((m) => {
                    const bubbleClass = m.isInternal
                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                      : m.isAdmin
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-900";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${m.isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${bubbleClass}`}>
                          {m.isInternal && (
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                              <Lock className="h-3 w-3" />
                              Internal note
                            </div>
                          )}
                          {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                          {m.attachments.map((a) => (
                            <AttachmentBubble
                              key={a.id}
                              url={a.url}
                              name={a.name}
                              type={a.type}
                              size={a.size}
                              invert={m.isAdmin && !m.isInternal}
                            />
                          ))}
                          <p
                            className={`text-[10px] mt-1 ${
                              m.isInternal
                                ? "text-amber-700"
                                : m.isAdmin
                                ? "text-indigo-200"
                                : "text-gray-500"
                            }`}
                          >
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply composer */}
                {selectedTicket.status !== "CLOSED" && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Internal note (not visible to customer)</span>
                    </label>
                    <div className="flex gap-2">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder={isInternal ? "Private note for the team..." : "Type your reply..."}
                        rows={2}
                        className={`flex-1 resize-none ${
                          isInternal ? "bg-amber-50 border-amber-200" : ""
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReply();
                          }
                        }}
                      />
                      <Button
                        onClick={handleReply}
                        disabled={(!reply.trim() && attachments.length === 0) || sending}
                        className={
                          isInternal
                            ? "bg-amber-600 hover:bg-amber-700 self-end"
                            : "bg-indigo-600 hover:bg-indigo-700 self-end"
                        }
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <AttachmentPicker
                      files={attachments}
                      onChange={setAttachments}
                      compact
                    />
                    {replyError && (
                      <p className="text-xs text-red-600">{replyError}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
