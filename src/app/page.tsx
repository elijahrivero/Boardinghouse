"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [overdueCount, setOverdueCount] = useState(0);

  return (
    <>
      <Nav overdueCount={overdueCount} />
      <main className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-100">
            Dashboard
          </h1>
        </div>
        <Dashboard onOverdueCountChange={setOverdueCount} />
      </main>
    </>
  );
}
