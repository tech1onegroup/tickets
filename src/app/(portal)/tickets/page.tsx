"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MessageSquare, Clock } from "lucide-react";
import {
  AttachmentPicker,
  appendAttachmentsToFormData,
  filesFromClipboard,
} from "@/components/shared/attachment-picker";

interface Ticket {
  id: string;
  ticketRef: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
}

const categories = [
  { value: "PAYMENT_DISPUTE", label: "Payment Dispute" },
  { value: "NAME_CHANGE", label: "Name Change" },
  { value: "ADDRESS_UPDATE", label: "Address Update" },
  { value: "CONSTRUCTION_QUERY", label: "Construction Query" },
  { value: "DOCUMENT_REQUEST", label: "Document Request" },
  { value: "GENERAL", label: "General" },
];

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

const categoryLabels: Record<string, string> = {
  PAYMENT_DISPUTE: "Payment Dispute",
  NAME_CHANGE: "Name Change",
  ADDRESS_UPDATE: "Address Update",
  CONSTRUCTION_QUERY: "Construction Query",
  DOCUMENT_REQUEST: "Document Request",
  GENERAL: "General",
};

export default function TicketsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category: "", subject: "", description: "", priority: "" });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    if (!accessToken) return;
    fetchTickets();
  }, [accessToken]);

  async function fetchTickets() {
    const token = tokenRef.current;
    if (!token) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error || `Server error (${res.status})`);
      }
    } catch {
      setFetchError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (
      !form.category &&
      !form.subject.trim() &&
      !form.description.trim() &&
      attachments.length === 0
    )
      return;
    setCreating(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("category", form.category);
      fd.append("subject", form.subject);
      fd.append("description", form.description);
      if (form.priority) fd.append("priority", form.priority);
      appendAttachmentsToFormData(fd, attachments);
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (res.ok) {
        setForm({ category: "", subject: "", description: "", priority: "" });
        setAttachments([]);
        setDialogOpen(false);
        fetchTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || "Failed to create ticket");
      }
    } catch (err) {
      console.error("Failed to create ticket:", err);
      setFormError("Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-sm text-red-600 font-medium">{fetchError}</p>
        <Button variant="outline" onClick={fetchTickets}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-500 mt-1">
            Raise and track your support requests
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div
              className="space-y-4 mt-4"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                const dropped = Array.from(e.dataTransfer.files || []);
                if (dropped.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                setAttachments((prev) => [...prev, ...dropped].slice(0, 10));
              }}
            >
              <p className="text-xs text-gray-500">
                All fields are optional — fill in whatever helps us understand your issue.
              </p>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, category: val || "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  placeholder="Brief summary of your issue"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  onPaste={(e) => {
                    const pasted = filesFromClipboard(e);
                    if (pasted.length > 0) {
                      e.preventDefault();
                      setAttachments((prev) =>
                        [...prev, ...pasted].slice(0, 10)
                      );
                    }
                  }}
                  placeholder="Describe your issue in detail (drag, drop, or paste files)"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Attachments</Label>
                <AttachmentPicker
                  files={attachments}
                  onChange={setAttachments}
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <Button
                onClick={handleCreate}
                disabled={
                  creating ||
                  (!form.category &&
                    !form.subject.trim() &&
                    !form.description.trim() &&
                    attachments.length === 0)
                }
                className="w-full"
              >
                {creating ? "Creating..." : "Submit Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No tickets yet</h3>
            <p className="text-gray-500 mt-1">
              Create a new ticket to get support
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket Ref</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const sc = statusConfig[ticket.status];
                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {ticket.ticketRef}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell>
                        {categoryLabels[ticket.category] || ticket.category}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc?.variant || "secondary"}>
                          {sc?.label || ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(ticket.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
