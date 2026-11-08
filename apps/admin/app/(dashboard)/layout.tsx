import { auth, signOut } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <AdminSidebar userEmail={session?.user?.email} signOutAction={signOutAction} />
      <div className="flex min-h-screen flex-col md:pl-64">
        <main className="flex-1 bg-surface-muted">{children}</main>
      </div>
      {modal}
    </div>
  );
}
