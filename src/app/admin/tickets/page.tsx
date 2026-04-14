"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  Phone,
  User,
  XCircle,
  Paperclip,
  FileText,
  X,
} from "lucide-react";

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
  createdAt: string;
}

interface TicketDetail {
  id: string;
  ticketRef: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  messages: Array<{
    id: string;
    senderId: string;
    message: string;
    isAdmin: boolean;
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentType: string | null;
    attachmentSize: number | null;
    createdAt: string;
  }>;
}

interface Counts {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  total: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  RESOLVED: { label: "Resolved", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-50 text-blue-600",
  HIGH: "bg-orange-50 text-orange-600",
  URGENT: "bg-red-100 text-red-700",
};

const categoryLabels: Record<string, string> = {
  PAYMENT_DISPUTE: "Payment Dispute",
  NAME_CHANGE: "Name Change",
  ADDRESS_UPDATE: "Address Update",
  CONSTRUCTION_QUERY: "Construction Query",
  DOCUMENT_REQUEST: "Document Request",
  GENERAL: "General",
};

function AdminMessageAttachment({
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
        <img
          src={url}
          alt={name}
          className="max-h-64 rounded-md border border-white/10"
        />
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
      {sizeKb && (
        <span className={invert ? "text-indigo-200" : "text-gray-500"}>{sizeKb}</span>
      )}
    </a>
  );
}

export default function AdminTicketsPage() {
  const { accessToken } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/admin/tickets?status=${filter}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setCounts(data.counts || { open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 });
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTicket = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/admin/tickets?id=${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data.ticket);
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
    }
  };

  const handleReply = async () => {
    if (!accessToken || !selectedTicket) return;
    if (!reply.trim() && !attachment) return;
    setSending(true);
    setReplyError(null);
    try {
      const fd = new FormData();
      fd.append("ticketId", selectedTicket.id);
      fd.append("reply", reply.trim());
      if (attachment) fd.append("file", attachment);
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (res.ok) {
        setReply("");
        setAttachment(null);
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

  const updateStatus = async (ticketId: string, status: string) => {
    if (!accessToken) return;
    try {
      await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ticketId, status }),
      });
      if (selectedTicket?.id === ticketId) {
        await openTicket(ticketId);
      }
      await fetchTickets();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const updatePriority = async (ticketId: string, priority: string) => {
    if (!accessToken) return;
    try {
      await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ticketId, priority }),
      });
      if (selectedTicket?.id === ticketId) {
        await openTicket(ticketId);
      }
      await fetchTickets();
    } catch (err) {
      console.error("Priority update failed:", err);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-indigo-500" />
          Support Tickets
        </h1>
        <p className="text-gray-500 mt-1">Manage and respond to customer support requests</p>
      </div>

      {/* Status filter cards */}
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          { key: "ALL", label: "All", count: counts.total, color: "from-gray-600 to-gray-800" },
          { key: "OPEN", label: "Open", count: counts.open, color: "from-orange-500 to-orange-700" },
          { key: "IN_PROGRESS", label: "In Progress", count: counts.inProgress, color: "from-blue-500 to-blue-700" },
          { key: "RESOLVED", label: "Resolved", count: counts.resolved, color: "from-emerald-500 to-emerald-700" },
          { key: "CLOSED", label: "Closed", count: counts.closed, color: "from-gray-400 to-gray-600" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl p-4 text-left transition-all ${
              filter === s.key
                ? `bg-gradient-to-br ${s.color} text-white shadow-lg scale-[1.02]`
                : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <p className={`text-xs font-medium ${filter === s.key ? "text-white/80" : "text-gray-500"}`}>
              {s.label}
            </p>
            <p className="text-2xl font-bold mt-1">{s.count}</p>
          </button>
        ))}
      </div>

      {/* Tickets Table */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {filter === "ALL" ? "All Tickets" : `${statusConfig[filter]?.label || filter} Tickets`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => {
                const sc = statusConfig[t.status];
                return (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openTicket(t.id)}>
                    <TableCell className="font-mono text-xs text-gray-500">{t.ticketRef}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                    <TableCell>
                      <div className="text-sm">{t.customerName}</div>
                      <div className="text-xs text-gray-400">{t.customerPhone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[t.category] || t.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${priorityColors[t.priority] || ""} text-xs border-0`}>
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${sc?.color || ""} text-xs border-0`}>
                        {sc?.label || t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(t.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openTicket(t.id); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                    No tickets found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-400">{selectedTicket?.ticketRef}</span>
                {selectedTicket && (
                  <Badge className={`${statusConfig[selectedTicket.status]?.color} text-xs border-0`}>
                    {statusConfig[selectedTicket.status]?.label}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              {/* Ticket info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="font-medium">{selectedTicket.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">+91 {selectedTicket.customerPhone}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Subject</p>
                <p className="font-medium text-sm">{selectedTicket.subject}</p>
              </div>

              {/* Status actions */}
              <div className="flex gap-2">
                {selectedTicket.status !== "IN_PROGRESS" && selectedTicket.status !== "RESOLVED" && selectedTicket.status !== "CLOSED" && (
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => updateStatus(selectedTicket.id, "IN_PROGRESS")}>
                    <Clock className="h-3 w-3 mr-1" /> Mark In Progress
                  </Button>
                )}
                {selectedTicket.status !== "RESOLVED" && selectedTicket.status !== "CLOSED" && (
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => updateStatus(selectedTicket.id, "RESOLVED")}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                  </Button>
                )}
                {selectedTicket.status !== "CLOSED" && (
                  <Button size="sm" variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-50" onClick={() => updateStatus(selectedTicket.id, "CLOSED")}>
                    <XCircle className="h-3 w-3 mr-1" /> Close
                  </Button>
                )}
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </span>
                <Select
                  value={selectedTicket.priority}
                  onValueChange={(val) =>
                    val && updatePriority(selectedTicket.id, val)
                  }
                >
                  <SelectTrigger className="h-8 w-36 text-sm">
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

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 border rounded-lg p-4 bg-white">
                {selectedTicket.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      m.isAdmin
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}>
                      {m.message && <p className="text-sm">{m.message}</p>}
                      {m.attachmentUrl && (
                        <AdminMessageAttachment
                          url={m.attachmentUrl}
                          name={m.attachmentName || "attachment"}
                          type={m.attachmentType}
                          size={m.attachmentSize}
                          invert={m.isAdmin}
                        />
                      )}
                      <p className={`text-[10px] mt-1 ${m.isAdmin ? "text-indigo-200" : "text-gray-400"}`}>
                        {formatDate(m.createdAt)} {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {selectedTicket.status !== "CLOSED" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your reply..."
                      rows={2}
                      className="flex-1 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                    />
                    <Button
                      onClick={handleReply}
                      disabled={(!reply.trim() && !attachment) || sending}
                      className="bg-indigo-600 hover:bg-indigo-700 self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {attachment ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      <span className="flex-1 truncate">{attachment.name}</span>
                      <span className="text-xs text-gray-500">
                        {(attachment.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="text-gray-500 hover:text-red-600"
                        aria-label="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-gray-600 cursor-pointer hover:border-gray-400">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>Attach PDF or image (max 25 MB)</span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setAttachment(f);
                        }}
                      />
                    </label>
                  )}
                  {replyError && (
                    <p className="text-xs text-red-600">{replyError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
