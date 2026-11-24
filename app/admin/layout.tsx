import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminUserProvider } from "./admin-user-provider";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/staff");
  return (
    <AdminUserProvider user={{ name: user.name, email: user.email }}>
      {children}
    </AdminUserProvider>
  );
}
