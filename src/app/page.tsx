"use client";

import Nav from "@/components/Nav";
import BedSpaceList from "@/components/BedSpaceList";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function Home() {
  const { authenticated } = useAdminAuth();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-stone-900">
          Bed Space Availability
        </h1>
        <BedSpaceList canEdit={authenticated === true} />
      </main>
    </>
  );
}
