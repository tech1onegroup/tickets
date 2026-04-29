"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { isTicketsOnly } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Phone,
  Shield,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  UserPlus,
  CheckCircle2,
  Loader2,
  Mail,
  User,
  Lock,
} from "lucide-react";

type Step = "phone" | "otp" | "register";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.7 1.2 7.8 3.1l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.2 7.8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.3a12 12 0 0 1-7.3 2.6c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.4l6.1 5.3c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.2-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [step, setStep] = useState<Step>("phone");
  const [isAdminMode, setIsAdminMode] = useState(false);

  const [customerPhone, setCustomerPhone] = useState("");
  const [adminPhone, setAdminPhone] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [customerError, setCustomerError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login, loginWithPhone, verifyOtp, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("googleError");

  useEffect(() => {
    if (!googleError) return;
    const map: Record<string, string> = {
      not_configured: "Google sign-in isn't configured yet.",
      no_account: "No account linked to that Google email. Log in with your phone number instead.",
      email_not_verified: "Your Google email isn't verified. Please verify it with Google and try again.",
      no_email: "Your Google account didn't share an email.",
      state_mismatch: "Sign-in link expired. Please try again.",
      exchange_failed: "Google sign-in failed. Please try again.",
      missing_code: "Google sign-in was cancelled.",
      session_failed: "Couldn't start your session. Please try again.",
      missing_token: "Sign-in completed without a token. Please try again.",
    };
    setCustomerError(map[googleError] || "Google sign-in failed. Please try again.");
  }, [googleError]);

  useEffect(() => {
    if (user) {
      const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      if (isTicketsOnly()) {
        router.replace(isAdmin ? "/admin/tickets" : "/tickets");
      } else {
        router.replace(isAdmin ? "/admin/dashboard" : "/dashboard");
      }
    }
  }, [user, router]);

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError("");
    setCustomerLoading(true);
    try {
      await login(customerPhone);
      setStep("otp");
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      await login(adminPhone);
      setStep("otp");
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) return;
    setOtpError("");
    setOtpLoading(true);
    try {
      await verifyOtp(isAdminMode ? adminPhone : customerPhone, otpString);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: regPhone, name: regName, email: regEmail, adminCode: regCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRegSuccess(data.message);
      setTimeout(() => {
        setStep("phone");
        setIsAdminMode(true);
        setAdminPhone(regPhone);
        setRegSuccess("");
      }, 2000);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-foreground/5 rounded-full blur-2xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight">ONE Group</h1>
              <p className="text-[11px] text-primary-foreground/40 tracking-widest uppercase">Real Estate</p>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h2 className="text-4xl font-bold text-primary-foreground leading-tight">
              {isTicketsOnly() ? (<>Your Questions,<br /><span className="bg-gradient-to-r from-accent to-primary-foreground bg-clip-text text-transparent">Answered Fast</span></>) : (<>Your Property,<br /><span className="bg-gradient-to-r from-accent to-primary-foreground bg-clip-text text-transparent">One Portal Away</span></>)}
            </h2>
            <p className="text-primary-foreground/50 text-lg leading-relaxed">
              {isTicketsOnly() ? "Raise a ticket for any query about your property and stay in direct conversation with the ONE Group team." : "Track payments, monitor construction progress, manage documents — everything about your property in one place."}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              {(isTicketsOnly()
                ? [{ icon: "💬", label: "Raise a Ticket" }, { icon: "🔔", label: "Live Updates" }, { icon: "📎", label: "Share Details" }, { icon: "✅", label: "Track to Resolution" }]
                : [{ icon: "💰", label: "Payment Tracking" }, { icon: "🏗️", label: "Construction Updates" }, { icon: "📄", label: "Document Vault" }, { icon: "🎯", label: "Referral Rewards" }]
              ).map((f) => (
                <div key={f.label} className="flex items-center gap-3 p-3 rounded-lg bg-primary-foreground/10 border border-primary-foreground/10">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-sm text-primary-foreground/70">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-primary-foreground/20 text-sm">&copy; {new Date().getFullYear()} ONE Group. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ONE Group</h1>
              <p className="text-[11px] text-muted-foreground tracking-widest uppercase">Customer Portal</p>
            </div>
          </div>

          {/* ── CUSTOMER LOGIN (default) ── */}
          {step === "phone" && !isAdminMode && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
                <p className="text-muted-foreground mt-2">Enter your registered phone number to receive a one-time code via WhatsApp</p>
              </div>

              <form onSubmit={handleCustomerLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="customer-phone" className="text-sm font-medium text-foreground">Phone Number</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 flex items-center pl-4 pr-3 border-r bg-muted rounded-l-lg text-sm text-muted-foreground font-medium">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      +91
                    </div>
                    <Input
                      id="customer-phone"
                      type="tel"
                      placeholder="9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      autoFocus
                      className="pl-24 h-12 text-lg tracking-wider"
                      required
                    />
                  </div>
                </div>

                {customerError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-600 text-xs font-bold">!</span>
                    </div>
                    <p className="text-sm text-red-600">{customerError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={customerLoading || customerPhone.length !== 10}
                >
                  {customerLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Get OTP <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-4 text-muted-foreground uppercase tracking-wider">Or</span>
                </div>
              </div>

              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </a>

              {/* Admin Login — dashed button */}
              <button
                onClick={() => { setIsAdminMode(true); setAdminError(""); }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-card transition-all"
              >
                <Shield className="h-4 w-4" />
                Login as Admin
              </button>
            </div>
          )}

          {/* ── ADMIN LOGIN ── */}
          {step === "phone" && isAdminMode && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <button
                  onClick={() => { setIsAdminMode(false); setAdminError(""); setAdminPhone(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 -ml-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Customer Login
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Admin Login</h2>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1">Enter your phone to receive a one-time code via WhatsApp</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="admin-phone" className="text-sm font-medium text-foreground">Phone Number</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 flex items-center pl-4 pr-3 border-r bg-muted rounded-l-lg text-sm text-muted-foreground font-medium">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      +91
                    </div>
                    <Input
                      id="admin-phone"
                      type="tel"
                      placeholder="9876543210"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      autoFocus
                      className="pl-24 h-12 text-lg tracking-wider"
                      required
                    />
                  </div>
                </div>

                {adminError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-600 text-xs font-bold">!</span>
                    </div>
                    <p className="text-sm text-red-600">{adminError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={adminLoading || adminPhone.length !== 10}
                >
                  {adminLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Get OTP <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-4 text-muted-foreground uppercase tracking-wider">Or</span>
                </div>
              </div>

              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </a>

              <button
                onClick={() => { setStep("register"); setAdminError(""); }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-card transition-all"
              >
                <UserPlus className="h-4 w-4" />
                Register as Admin
              </button>
            </div>
          )}

          {/* ── OTP VERIFY (admin) ── */}
          {step === "otp" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <button
                  onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); setOtpError(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 -ml-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-foreground">Verify OTP</h2>
                <p className="text-muted-foreground mt-2">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-foreground">+91 {isAdminMode ? adminPhone : customerPhone}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <div className="flex justify-center gap-3" onPaste={handlePaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-13 h-14 rounded-xl border-2 border-border text-center text-2xl font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all bg-card"
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-600 text-xs font-bold">!</span>
                    </div>
                    <p className="text-sm text-red-600">{otpError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={otpLoading || otp.join("").length !== 6}
                >
                  {otpLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><KeyRound className="h-4 w-4 mr-2" />Verify & Login</>}
                </Button>
              </form>
            </div>
          )}

          {/* ── ADMIN REGISTRATION ── */}
          {step === "register" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <button
                  onClick={() => { setStep("phone"); setRegError(""); setRegSuccess(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 -ml-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Admin Registration</h2>
                </div>
                <p className="text-muted-foreground mt-1">Register a new admin account with your organization code</p>
              </div>

              {regSuccess && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">{regSuccess}</p>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Your full name" value={regName} onChange={(e) => setRegName(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="tel" placeholder="9876543210" value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="pl-10 h-11" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="admin@onegroup.in" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Admin Registration Code</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" placeholder="Enter organization code" value={regCode} onChange={(e) => setRegCode(e.target.value)} className="pl-10 h-11" required />
                  </div>
                </div>

                {regError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-600 text-xs font-bold">!</span>
                    </div>
                    <p className="text-sm text-red-600">{regError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={regLoading || !regName || regPhone.length !== 10 || !regCode}
                >
                  {regLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-2" />Create Admin Account</>}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
