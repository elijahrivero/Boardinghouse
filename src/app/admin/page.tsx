"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import AdminPanel from "@/components/AdminPanel";
import Link from "next/link";
import { notifyAuthChanged } from "@/hooks/useAdminAuth";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch("/api/admin/check", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Auth check failed');
        }
        
        const data = await response.json();
        setAuthenticated(data.ok === true);
      } catch (error) {
        console.error("Auth check failed:", error);
        setAuthenticated(false);
      }
    };

    checkAuth();
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
        
        // Show development mode message if applicable
        if (data.development) {
          console.log("🚀 Development mode: Authentication bypassed");
        }
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
          <div className="text-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
            <p className="text-slate-400">Checking authentication...</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-slate-500 hover:text-slate-300 underline"
            >
              If this takes too long, click here to reload
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg">
            <h1 className="mb-2 text-xl font-semibold text-slate-100">Admin Login</h1>
            <p className="mb-6 text-sm text-slate-400">
              Sign in to manage bed spaces and tenant balances.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-username" className="mb-1 block text-sm font-medium text-slate-300">
                  Username
                </label>
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  required
                />
              </div>
              {error && (
                <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-500 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-500">
              <strong>Note:</strong> Make sure your .env.local file contains:<br/>
              <code className="bg-slate-700 px-1 rounded">ADMIN_USERNAME=admin</code><br/>
              <code className="bg-slate-700 px-1 rounded">ADMIN_PASSWORD=admin123</code>
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Admin</h1>
            <p className="text-sm text-slate-400">
              Manage bed spaces and tenant balances.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Log out
            </button>
          </div>
        </div>

        <AdminPanel />
      </main>
    </>
  );
}
