export const PHASE = process.env.NEXT_PUBLIC_PHASE || "FULL";

export const isTicketsOnly = () => PHASE === "TICKETS_ONLY";

export const CUSTOMER_ALLOWED = new Set([
  "/tickets",
  "/notifications",
  "/profile",
]);

export const ADMIN_ALLOWED = new Set(["/admin/tickets", "/admin/customers"]);

export function isAllowedPath(
  role: "CUSTOMER" | "ADMIN",
  pathname: string
): boolean {
  if (!isTicketsOnly()) return true;
  const allowed = role === "ADMIN" ? ADMIN_ALLOWED : CUSTOMER_ALLOWED;
  for (const p of allowed) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
  }
  return false;
}
