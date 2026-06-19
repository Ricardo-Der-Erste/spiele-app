"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { BalanceDisplay } from "@/components/balance-display";

export function Navbar() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur border-b border-gray-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          🎮 SpieleHub
        </Link>

        {/* Desktop Links */}
        <div className="hidden items-center gap-6 sm:flex">
          <Link href="/" className="text-gray-300 hover:text-white transition">
            Home
          </Link>
          <Link href="/leaderboard" className="text-gray-300 hover:text-white transition">
            Rangliste
          </Link>
          <Link href="/werkstatt" className="text-gray-300 hover:text-white transition">
            🔨 Werkstatt
          </Link>
          {user ? (
            <>
              <Link href="/profile" className="text-gray-300 hover:text-white transition">
                Profil
              </Link>
              <BalanceDisplay />
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition"
              >
                Abmelden
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
            >
              Anmelden
            </Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden rounded p-1 text-gray-300 hover:text-white"
          aria-label="Menü"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 pb-4 sm:hidden">
          <div className="flex flex-col gap-3 pt-3">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="text-gray-300 hover:text-white transition"
            >
              Home
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setMenuOpen(false)}
              className="text-gray-300 hover:text-white transition"
            >
              Rangliste
            </Link>
            <Link
              href="/werkstatt"
              onClick={() => setMenuOpen(false)}
              className="text-gray-300 hover:text-white transition"
            >
              🔨 Werkstatt
            </Link>
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition"
                >
                  Profil
                </Link>
                <div className="py-1">
                  <BalanceDisplay />
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-left text-sm font-medium text-white hover:bg-red-500 transition"
                >
                  Abmelden
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-center text-sm font-medium text-white hover:bg-indigo-500 transition"
              >
                Anmelden
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}