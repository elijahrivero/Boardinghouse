"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Bed Spaces" },
  { href: "/tenants", label: "Tenant Balance" },
  { href: "/parcels", label: "Parcels" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="text-lg font-semibold text-stone-900">
          Boarding House
        </Link>
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === href
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
