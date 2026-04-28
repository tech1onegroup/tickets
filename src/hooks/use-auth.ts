"use client";

import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  phone: string;
  email: string | null;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
  name: string | null;
  customer?: {
    id: string;
    name: string;
    email: string | null;
    bookings: Array<{
      id: string;
      bookingRef: string;
      unitNumber: string;
      projectName: string;
      totalAmount: string;
    }>;
  } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  login: (phone: string) => Promise<{ success: boolean; otp?: string }>;
  loginWithPhone: (phone: string) => Promise<boolean>;
  verifyOtp: (phone: string, otp: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  login: async () => ({ success: false }),
  loginWithPhone: async () => false,
  verifyOtp: async () => false,
  logout: () => {},
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}
