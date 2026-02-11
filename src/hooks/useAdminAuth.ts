"use client";

import { useEffect, useState } from "react";

const AUTH_CHANNEL = "admin-auth";

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const checkAuth = () => {
    fetch("/api/admin/check", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAuthenticated(data.ok === true))
      .catch(() => setAuthenticated(false));
  };

  useEffect(() => {
    checkAuth();
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(AUTH_CHANNEL) : null;
    const onMessage = () => checkAuth();
    channel?.addEventListener("message", onMessage);
    return () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
    };
  }, []);

  return { authenticated, checkAuth };
}

export function notifyAuthChanged() {
  if (typeof BroadcastChannel !== "undefined") {
    new BroadcastChannel(AUTH_CHANNEL).postMessage("auth-changed");
  }
}
