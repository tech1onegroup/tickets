"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Eye,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  CreditCard,
  AlertCircle,
  Loader2,
  MessageSquare,
  UserPlus,
  Pencil,
  Save,
  X,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { SendMessageDialog } from "@/components/admin/send-message-dialog";
import { CreateCustomerDialog } from "@/components/admin/create-customer-dialog";
import { isTicketsOnly } from "@/lib/features";

const HIDE_BOOKINGS_IN_LIST = isTicketsOnly();

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookingsCount: number;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  profession: string | null;
  companyName: string | null;
  createdAt: string;
  user: { phone: string | null; email: string | null; role: string; lastLoginAt: string | null };
  bookings: Array<{
    id: string;
    bookingRef: string;
    bookingDate: string;
    totalAmount: number;
    totalPaid: number;
    totalDue: number;
    status: string;
    overdueCount: number;
    unit: {
      unitNumber: string;
      unitType: string;
      areaSqFt: number | null;
      floor: number | null;
      project: { name: string; city: string; state: string };
    };
    coApplicants: Array<{ name: string; phone: string | null; relationship: string | null }>;
    schedule: Array<{
      id: string;
      instalmentNo: number;
      label: string;
      dueDate: string;
      amount: number;
      interestAmount: number;
      status: string;
      escalationStage: number;
    }>;
  }>;
}

interface EditForm {
  title: string;
  name: string;
  email: string;
  altPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  panNumber: string;
  aadhaarNumber: string;
  profession: string;
  companyName: string;
}

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusColor: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  UPCOMING: "bg-blue-100 text-blue-700",
  OVERDUE: "bg-red-100 text-red-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  WAIVED: "bg-gray-100 text-gray-600",
};

export default function CustomersPage() {
  const { accessToken } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [messagingTarget, setMessagingTarget] = useState<
    { customerId: string; customerName: string } | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    totalErrors: number;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;

    async function fetchCustomers() {
      try {
        const res = await fetch("/api/admin/customers", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error("Failed to load customers:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, [accessToken]);

  async function openDetail(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    setIsEditing(false);
    setEditForm(null);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setDetail(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  function startEdit() {
    if (!detail) return;
    setEditForm({
      title: detail.title || "",
      name: detail.name,
      email: detail.email || "",
      altPhone: detail.altPhone || "",
      address: detail.address || "",
      city: detail.city || "",
      state: detail.state || "",
      pincode: detail.pincode || "",
      panNumber: detail.panNumber || "",
      aadhaarNumber: detail.aadhaarNumber || "",
      profession: detail.profession || "",
      companyName: detail.companyName || "",
    });
    setIsEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditForm(null);
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editForm || !detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/customers/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to save");
        return;
      }
      setDetail((prev) => (prev ? { ...prev, ...data } : prev));
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === detail.id
            ? { ...c, name: data.name, email: data.email }
            : c
        )
      );
      setIsEditing(false);
      setEditForm(null);
    } catch (err) {
      console.error(err);
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/customers/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ imported: 0, skipped: 0, errors: [data.error], totalErrors: 1 });
      } else {
        setImportResult(data);
        if (data.imported > 0) {
          // Refresh the list
          const listRes = await fetch("/api/admin/customers", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            setCustomers(listData.customers || []);
          }
        }
      }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ["Network error"], totalErrors: 1 });
    } finally {
      setImporting(false);
      // Reset input so same file can be re-uploaded
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage all registered customers</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="gap-1.5"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing ? "Importing…" : "Import CSV"}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            New Customer
          </Button>
        </div>
      </div>

      {importResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-start gap-3 ${
            importResult.totalErrors > 0 && importResult.imported === 0
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              Import complete — {importResult.imported} added, {importResult.skipped} skipped
              {importResult.totalErrors > 0 && `, ${importResult.totalErrors} errors`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 text-xs opacity-80 space-y-0.5">
                {importResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setImportResult(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Customers ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                {!HIDE_BOOKINGS_IN_LIST && <TableHead>Bookings</TableHead>}
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone ? `+91 ${customer.phone}` : "—"}</TableCell>
                  <TableCell className="text-gray-500">
                    {customer.email || "-"}
                  </TableCell>
                  {!HIDE_BOOKINGS_IN_LIST && (
                    <TableCell>
                      <Badge variant="secondary">{customer.bookingsCount}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-gray-500">
                    {new Date(customer.createdAt).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(customer.id)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={HIDE_BOOKINGS_IN_LIST ? 5 : 6}
                    className="text-center text-gray-500 py-8"
                  >
                    No customers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={openId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setDetail(null);
            setIsEditing(false);
            setEditForm(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>
              Contact details, profile, and bookings
            </SheetDescription>
          </SheetHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {!detailLoading && detail && (
            <div className="space-y-6 px-4 pb-6">
              {/* Profile */}
              <section>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg shrink-0">
                    {detail.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-gray-900">
                      {detail.title ? `${detail.title} ` : ""}
                      {detail.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Customer since {formatDate(detail.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!isEditing && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startEdit}
                          className="gap-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMessagingTarget({
                              customerId: detail.id,
                              customerName: detail.name,
                            })
                          }
                          className="gap-1.5"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Message
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Read-only view */}
                {!isEditing && (
                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <InfoRow icon={Phone} label="Phone" value={detail.phone ? `+91 ${detail.phone}` : "—"} />
                    {detail.altPhone && (
                      <InfoRow icon={Phone} label="Alt Phone" value={`+91 ${detail.altPhone}`} />
                    )}
                    <InfoRow icon={Mail} label="Email" value={detail.email || "—"} />
                    <InfoRow
                      icon={MapPin}
                      label="Location"
                      value={[detail.city, detail.state].filter(Boolean).join(", ") || "—"}
                    />
                    {detail.address && (
                      <div className="col-span-2">
                        <InfoRow icon={MapPin} label="Address" value={detail.address} />
                      </div>
                    )}
                    {detail.pincode && (
                      <InfoRow icon={MapPin} label="Pincode" value={detail.pincode} />
                    )}
                    {detail.panNumber && (
                      <InfoRow icon={User} label="PAN" value={detail.panNumber} />
                    )}
                    {detail.aadhaarNumber && (
                      <InfoRow icon={User} label="Aadhaar" value={detail.aadhaarNumber} />
                    )}
                    {detail.profession && (
                      <InfoRow icon={User} label="Profession" value={detail.profession} />
                    )}
                    {detail.companyName && (
                      <InfoRow icon={Building2} label="Company" value={detail.companyName} />
                    )}
                  </div>
                )}

                {/* Edit form */}
                {isEditing && editForm && (
                  <div className="mt-4 space-y-3">
                    {saveError && (
                      <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                        {saveError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Title</label>
                        <Input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          placeholder="Mr / Mrs / Dr"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Name *</label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Full name"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Phone (login, non-editable)</label>
                        <Input
                          value={detail.phone ? `+91 ${detail.phone}` : "No phone"}
                          disabled
                          className="h-8 text-sm bg-gray-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Alt Phone</label>
                        <Input
                          value={editForm.altPhone}
                          onChange={(e) => setEditForm({ ...editForm, altPhone: e.target.value })}
                          placeholder="10-digit number"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">Email</label>
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="email@example.com"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">Address</label>
                        <Input
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          placeholder="Street address"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">City</label>
                        <Input
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          placeholder="City"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">State</label>
                        <Input
                          value={editForm.state}
                          onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                          placeholder="State"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Pincode</label>
                        <Input
                          value={editForm.pincode}
                          onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                          placeholder="6-digit pincode"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">PAN</label>
                        <Input
                          value={editForm.panNumber}
                          onChange={(e) =>
                            setEditForm({ ...editForm, panNumber: e.target.value.toUpperCase() })
                          }
                          placeholder="ABCDE1234F"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Aadhaar</label>
                        <Input
                          value={editForm.aadhaarNumber}
                          onChange={(e) =>
                            setEditForm({ ...editForm, aadhaarNumber: e.target.value })
                          }
                          placeholder="12-digit number"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Profession</label>
                        <Input
                          value={editForm.profession}
                          onChange={(e) =>
                            setEditForm({ ...editForm, profession: e.target.value })
                          }
                          placeholder="e.g. Engineer"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">Company</label>
                        <Input
                          value={editForm.companyName}
                          onChange={(e) =>
                            setEditForm({ ...editForm, companyName: e.target.value })
                          }
                          placeholder="Company name"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={saving}
                        className="gap-1.5"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <div className="h-px bg-gray-100" />

              {/* Bookings / Projects — always visible for admin */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  Projects &amp; Bookings ({detail.bookings.length})
                </h3>
                {detail.bookings.length === 0 && (
                  <p className="text-sm text-gray-500">No bookings yet.</p>
                )}
                <div className="space-y-4">
                  {detail.bookings.map((b) => (
                    <div key={b.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {b.unit.project.name} · {b.unit.unitNumber}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {b.unit.unitType}
                            {b.unit.areaSqFt ? ` · ${b.unit.areaSqFt} sq ft` : ""}
                            {b.unit.floor ? ` · Floor ${b.unit.floor}` : ""}
                            {b.unit.project.city ? ` · ${b.unit.project.city}` : ""}
                          </p>
                          {b.totalAmount > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Ref {b.bookingRef} · Booked {formatDate(b.bookingDate)}
                            </p>
                          )}
                        </div>
                        {b.totalAmount > 0 && (
                          <Badge
                            className={
                              b.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {b.status}
                          </Badge>
                        )}
                      </div>

                      {b.totalAmount > 0 && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <Stat label="Total" value={formatINR(b.totalAmount)} />
                          <Stat label="Paid" value={formatINR(b.totalPaid)} tone="green" />
                          <Stat
                            label="Due"
                            value={formatINR(b.totalDue)}
                            tone={b.totalDue > 0 ? "red" : "gray"}
                          />
                        </div>
                      )}

                      {b.overdueCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {b.overdueCount} overdue instalment{b.overdueCount > 1 ? "s" : ""}
                        </div>
                      )}

                      {b.coApplicants.length > 0 && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Co-applicants:</span>{" "}
                          {b.coApplicants.map((c) => c.name).join(", ")}
                        </div>
                      )}

                      {b.totalAmount > 0 && b.schedule.length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            Payment Schedule
                          </p>
                          <div className="rounded border border-gray-100 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 text-gray-500 font-medium">#</th>
                                  <th className="text-left p-2 text-gray-500 font-medium">Label</th>
                                  <th className="text-left p-2 text-gray-500 font-medium">Due</th>
                                  <th className="text-right p-2 text-gray-500 font-medium">Amount</th>
                                  <th className="p-2 text-gray-500 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.schedule.map((s) => (
                                  <tr key={s.id} className="border-t border-gray-100">
                                    <td className="p-2 text-gray-400">{s.instalmentNo}</td>
                                    <td className="p-2 text-gray-700">
                                      {s.label}
                                      {s.interestAmount > 0 && (
                                        <span className="ml-1 text-red-600">
                                          + {formatINR(s.interestAmount)} late fee
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2 text-gray-500">{formatDate(s.dueDate)}</td>
                                    <td className="p-2 text-right text-gray-800 font-medium">
                                      {formatINR(s.amount + s.interestAmount)}
                                    </td>
                                    <td className="p-2">
                                      <span
                                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                          statusColor[s.status] || "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        {s.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <SendMessageDialog
        target={messagingTarget}
        onClose={() => setMessagingTarget(null)}
        accessToken={accessToken}
      />

      <CreateCustomerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accessToken={accessToken}
        onCreated={(newCustomer) => {
          setCustomers((prev) => [newCustomer, ...prev]);
        }}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: string;
  tone?: "gray" | "green" | "red";
}) {
  const bg =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-gray-50 text-gray-700";
  return (
    <div className={`rounded p-2 ${bg}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="font-semibold text-sm mt-0.5">{value}</p>
    </div>
  );
}
