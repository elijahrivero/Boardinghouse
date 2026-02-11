"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import BedSpaceList from "@/components/BedSpaceList";
import TenantBalanceList from "@/components/TenantBalanceList";
import Link from "next/link";
import { notifyAuthChanged } from "@/hooks/useAdminAuth";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((data) => setAuthenticated(data.ok === true))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthenticated(true);
        setPassword("");
        notifyAuthChanged(); // Tell other tabs to refresh auth state
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    notifyAuthChanged(); // Tell other tabs to refresh auth state
  };

  if (authenticated === null) {
    return (
      <>
        <Nav />
        <main className="mx-auto flex max-w-4xl items-center justify-center px-4 py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </main>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-xl font-semibold text-stone-900">Admin Login</h1>
            <p className="mb-6 text-sm text-stone-500">
              Sign in to manage bed spaces and tenant balances.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-username" className="mb-1 block text-sm font-medium text-stone-700">
                  Username
                </label>
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-stone-700">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  required
                />
              </div>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-stone-400">
              Credentials are set via ADMIN_USERNAME and ADMIN_PASSWORD in .env.local
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Admin</h1>
            <p className="text-sm text-stone-500">
              Manage bed spaces and tenant balances.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="mb-4 text-lg font-medium text-stone-700">Bed Space Management</h2>
            <BedSpaceList canEdit />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium text-stone-700">Tenant Balance</h2>
            <TenantBalanceList canEdit />
          </section>
        </div>
      </main>
    </>
  );
}
