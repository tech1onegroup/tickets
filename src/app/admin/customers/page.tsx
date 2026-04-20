"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { SendMessageDialog } from "@/components/admin/send-message-dialog";
import { CreateCustomerDialog } from "@/components/admin/create-customer-dialog";
import { isTicketsOnly } from "@/lib/features";

const HIDE_BOOKINGS = isTicketsOnly();

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bookingsCount: number;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  title: string | null;
  phone: string;
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
  user: { phone: string; email: string | null; role: string; lastLoginAt: string | null };
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
  const [messagingTarget, setMessagingTarget] = useState<
    { customerId: string; customerName: string } | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
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
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          New Customer
        </Button>
      </div>

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
                {!HIDE_BOOKINGS && <TableHead>Bookings</TableHead>}
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>+91 {customer.phone}</TableCell>
                  <TableCell className="text-gray-500">
                    {customer.email || "-"}
                  </TableCell>
                  {!HIDE_BOOKINGS && (
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
                  <TableCell colSpan={HIDE_BOOKINGS ? 5 : 6} className="text-center text-gray-500 py-8">
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
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>
              {HIDE_BOOKINGS
                ? "Contact details and profile"
                : "Full profile, bookings, and payment history"}
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
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                    {detail.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900">
                      {detail.title ? `${detail.title} ` : ""}
                      {detail.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Customer since {formatDate(detail.createdAt)}
                    </p>
                  </div>
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
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <InfoRow icon={Phone} label="Phone" value={`+91 ${detail.phone}`} />
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
              </section>

              {!HIDE_BOOKINGS && <div className="h-px bg-gray-100" />}

              {/* Bookings */}
              {!HIDE_BOOKINGS && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  Bookings ({detail.bookings.length})
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
                            {" · "}
                            {b.unit.project.city}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Ref {b.bookingRef} · Booked {formatDate(b.bookingDate)}
                          </p>
                        </div>
                        <Badge
                          className={
                            b.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {b.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <Stat label="Total" value={formatINR(b.totalAmount)} />
                        <Stat label="Paid" value={formatINR(b.totalPaid)} tone="green" />
                        <Stat
                          label="Due"
                          value={formatINR(b.totalDue)}
                          tone={b.totalDue > 0 ? "red" : "gray"}
                        />
                      </div>

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

                      {b.schedule.length > 0 && (
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
                                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor[s.status] || "bg-gray-100 text-gray-600"}`}
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
              )}
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
