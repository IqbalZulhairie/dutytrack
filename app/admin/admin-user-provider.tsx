"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AdminIdentity = {
  name: string;
  email: string;
};

const AdminUserContext = createContext<AdminIdentity | null>(null);

export function AdminUserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: AdminIdentity;
}) {
  return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>;
}

export function useAdminUser() {
  const user = useContext(AdminUserContext);
  if (!user) throw new Error("Admin user context is missing.");
  return user;
}
