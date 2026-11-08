import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-base border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">
          <span style={{ color: "var(--brand-primary)" }}>Viva</span>Bloom Admin
        </h1>
        <p className="mb-6 text-sm text-text-muted">Sign in to manage stores, coupons, and content.</p>
        <LoginForm />
      </div>
    </div>
  );
}
