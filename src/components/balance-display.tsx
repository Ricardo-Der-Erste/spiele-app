"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";

export function BalanceDisplay() {
  const { user } = useAuthStore();
  const { wallet, loading, fetchWallet } = useWalletStore();

  useEffect(() => {
    if (user) {
      fetchWallet(user.id);
    }
  }, [user, fetchWallet]);

  if (!user) return null;

  return (
    <Link
      href="/shop"
      className="flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/30 transition"
    >
      <span>🪙</span>
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : (
        <span>{wallet?.balance?.toLocaleString() ?? "0"}</span>
      )}
    </Link>
  );
}