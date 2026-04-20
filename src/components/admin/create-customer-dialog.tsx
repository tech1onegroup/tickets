"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bookingsCount: number;
  createdAt: string;
}

export function CreateCustomerDialog({
  open,
  onClose,
  accessToken,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accessToken: string | null;
  onCreated: (customer: NewCustomer) => void;
}) {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setName("");
    setPhone("");
    setEmail("");
    setCity("");
    setState("");
  }

  async function submit() {
    if (!accessToken) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit Indian phone number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim(),
          title: title.trim(),
          city: city.trim(),
          state: state.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create customer");
        return;
      }
      toast.success(`Customer ${data.customer.name} created`);
      onCreated(data.customer);
      reset();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New Customer
          </DialogTitle>
          <DialogDescription>
            Create a new customer. They can log in with the phone number via OTP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <Label htmlFor="title" className="text-xs">
                Title
              </Label>
              <Input
                id="title"
                placeholder="Mr."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="col-span-3">
              <Label htmlFor="name" className="text-xs">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Customer full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              maxLength={10}
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">
              10 digits, starting with 6-9. Customer logs in via OTP sent to this number.
            </p>
          </div>

          <div>
            <Label htmlFor="email" className="text-xs">
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city" className="text-xs">
                City (optional)
              </Label>
              <Input
                id="city"
                placeholder="Gurugram"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="state" className="text-xs">
                State (optional)
              </Label>
              <Input
                id="state"
                placeholder="Haryana"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Customer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
