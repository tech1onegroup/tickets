"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, User, Headphones, FileText } from "lucide-react";
import {
  AttachmentPicker,
  appendAttachmentsToFormData,
} from "@/components/shared/attachment-picker";

interface TicketDetail {
  id: string;
  ticketRef: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messages: TicketMessage[];
}

interface TicketAttachment {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

interface TicketMessage {
  id: string;
  senderId: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
  isCustomer: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OPEN: { label: "Open", variant: "destructive" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  RESOLVED: { label: "Resolved", variant: "secondary" },
  CLOSED: { label: "Closed", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  LOW: { label: "Low", variant: "outline" },
  MEDIUM: { label: "Medium", variant: "secondary" },
  HIGH: { label: "High", variant: "default" },
  URGENT: { label: "Urgent", variant: "destructive" },
};

function MessageAttachment({
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
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block"
      >
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
      className={`mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        invert
          ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
      }`}
    >
      <FileText className="h-4 w-4" />
      <span className="flex-1 truncate">{name}</span>
      {sizeKb && (
        <span className={invert ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>
          {sizeKb}
        </span>
      )}
    </a>
  );
}

const categoryLabels: Record<string, string> = {
  PAYMENT_DISPUTE: "Payment Dispute",
  NAME_CHANGE: "Name Change",
  ADDRESS_UPDATE: "Address Update",
  CONSTRUCTION_QUERY: "Construction Query",
  DOCUMENT_REQUEST: "Document Request",
  GENERAL: "General",
};

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    fetchTicket();

    // Live updates via Server-Sent Events. Fallback to polling if stream errors.
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const es = new EventSource(
      `/api/tickets/${id}/stream?token=${encodeURIComponent(accessToken)}`
    );
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "message") {
          setTicket((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.some((m) => m.id === event.message.id)
                    ? prev.messages
                    : [...prev.messages, event.message],
                  updatedAt: new Date().toISOString(),
                }
              : prev
          );
        } else if (event.type === "ticket_changed") {
          fetchTicket({ silent: true });
        }
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => {
      // Network/proxy hiccup — fall back to polling until the stream reconnects.
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          if (document.visibilityState === "visible") {
            fetchTicket({ silent: true });
          }
        }, 5000);
      }
    };
    es.addEventListener("ready", () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    });
    return () => {
      es.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [accessToken, id]);

  async function fetchTicket(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setTicket(await res.json());
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  async function handleSendReply() {
    if ((!reply.trim() && attachments.length === 0) || !accessToken) return;
    setSending(true);
    setReplyError(null);
    try {
      const fd = new FormData();
      fd.append("message", reply);
      appendAttachmentsToFormData(fd, attachments);
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (res.ok) {
        const newMsg = await res.json();
        setTicket((prev) =>
          prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev
        );
        setReply("");
        setAttachments([]);
      } else {
        const data = await res.json().catch(() => ({}));
        setReplyError(data.error || "Failed to send reply");
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
      setReplyError("Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Ticket not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
      </div>
    );
  }

  const sc = statusConfig[ticket.status];
  const isClosed = ticket.status === "CLOSED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ticket.ticketRef} - Created {formatDate(ticket.createdAt)}
          </p>
        </div>
      </div>

      {/* Ticket Info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={sc?.variant || "secondary"}>
              {sc?.label || ticket.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {categoryLabels[ticket.category] || ticket.category}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{formatDate(ticket.updatedAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversation Thread */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.isCustomer ? "justify-end" : "justify-start"}`}
              >
                {!msg.isCustomer && (
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Headphones className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-3 ${
                    msg.isCustomer
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.message && (
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  )}
                  {msg.attachments.map((a) => (
                    <MessageAttachment
                      key={a.id}
                      url={a.url}
                      name={a.name}
                      type={a.type}
                      size={a.size}
                      invert={msg.isCustomer}
                    />
                  ))}
                  <p
                    className={`text-xs mt-1 ${
                      msg.isCustomer ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {formatDateTime(msg.createdAt)}
                  </p>
                </div>
                {msg.isCustomer && (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Reply Form */}
          {!isClosed && (
            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendReply}
                  disabled={sending || (!reply.trim() && attachments.length === 0)}
                  className="self-end"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
              <AttachmentPicker
                files={attachments}
                onChange={setAttachments}
                compact
              />
              {replyError && (
                <p className="text-sm text-red-600">{replyError}</p>
              )}
            </div>
          )}

          {isClosed && (
            <div className="mt-6 text-center py-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">
                This ticket is closed. Create a new ticket if you need further assistance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
