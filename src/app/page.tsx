"use client";

import Nav from "@/components/Nav";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-100">
            Boarding House Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-2">
            Manage your boarding house efficiently
          </p>
        </div>
        <Dashboard />
      </main>
    </>
  );
}
