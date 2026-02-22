"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "chart-bar" },
  { href: "/admin", label: "Admin", icon: "cog" }
];

export default function Nav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l2 2m6-2l2 2m0 0l-2-2m-8 8V5a2 2 0 012-2h8a2 2 0 012 2v14l-3-3m0 0l3 3m-3-3h6" />
            </svg>
            Boarding House
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex gap-1">
            {NAV_LINKS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                  pathname === href
                    ? "bg-slate-700 text-slate-100 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {icon === "chart-bar" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />}
                  {icon === "cog" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0 1.594-2.924 3.35-2.924 1.594 0 3.35 2.924 1.594 3.35a2.824 2.824 0 005.646 0 2.924 0 1.594 2.924 1.594 0 2.924-2.824 2.824-2.824h-4.705c-1.594 0-2.824-1.594-2.824v4.705c0 1.594 1.594 2.824 2.824h4.705z" />}
                </svg>
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="sm:hidden py-2 border-t border-slate-800">
            <div className="py-2 space-y-1">
              {NAV_LINKS.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition ${
                    pathname === href
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {icon === "chart-bar" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />}
                    {icon === "cog" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0 1.594-2.924 3.35-2.924 1.594 0 3.35 2.924 1.594 3.35a2.824 2.824 0 005.646 0 2.924 0 1.594 2.924 1.594 0 2.924-2.824 2.824-2.824h-4.705c-1.594 0-2.824-1.594-2.824v4.705c0 1.594 1.594 2.824 2.824h4.705z" />}
                  </svg>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
