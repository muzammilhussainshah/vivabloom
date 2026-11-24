import { connectToDatabase, getSiteSettings } from "@monocoupon/db";
import { auth, signOut } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { siteUrl } from "@/components/ui";
import { UsageDock } from "@/components/UsageDock";
import { DialogProvider } from "@/components/ui/Dialogs";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  await connectToDatabase();
  const [session, settings] = await Promise.all([auth(), getSiteSettings()]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <DialogProvider>
    <div className="min-h-screen">
      <AdminSidebar
        userEmail={session?.user?.email}
        siteName={settings.siteName || "VivaBloom"}
        siteUrl={siteUrl("")}
        signOutAction={signOutAction}
      />
      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Off-white canvas so the white cards and tables stand out. */}
        <main className="flex-1 bg-surface">{children}</main>
      </div>
      {modal}
      <UsageDock />
    </div>
    </DialogProvider>
  );
}
