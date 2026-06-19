"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import { useWalletStore } from "@/lib/wallet-store";
import { useRouter } from "next/navigation";
import type { CoinPackage } from "@/types/monetization";

export default function ShopPage() {
  const { user, loading: authLoading } = useAuthStore();
  const { wallet, fetchWallet, addCoins } = useWalletStore();
  const router = useRouter();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchWallet(user.id);

    const supabase = createClient();
    supabase
      .from("coin_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setPackages(data as CoinPackage[]);
        setLoading(false);
      });
  }, [user]);

  const handlePurchase = async (pkg: CoinPackage) => {
    if (!user) return;
    setPurchasing(pkg.id);
    setMessage(null);

    // Simulierter Kauf (im echten System: Stripe/PayPal)
    const totalCoins = pkg.coins + pkg.bonus_coins;
    const success = await addCoins(
      user.id,
      totalCoins,
      "purchase",
      `💎 ${pkg.name}-Paket: ${totalCoins} Coins (${(pkg.price_cents / 100).toFixed(2)}€)`,
      `package_${pkg.id}`
    );

    if (success) {
      setMessage(`✅ ${totalCoins} Coins gekauft! Viel Spaß beim Bauen!`);
      await fetchWallet(user.id);
    } else {
      setMessage("❌ Fehler beim Kauf. Versuche es später erneut.");
    }
    setPurchasing(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Lade Shop...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">🪙 Coin-Shop</h1>
      <p className="mb-6 text-gray-400">
        Kaufe Coins, um Ersatzteile und Arbeiter für deine Bauprojekte zu bezahlen.
      </p>

      {/* Aktuelles Guthaben */}
      <div className="mb-8 flex items-center justify-between rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
        <div>
          <p className="text-sm text-gray-400">Dein Guthaben</p>
          <p className="text-3xl font-bold text-yellow-400">
            🪙 {wallet?.balance?.toLocaleString() ?? "0"}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          Lebenszeit verdient: {wallet?.total_earned?.toLocaleString() ?? 0} Coins
        </div>
      </div>

      {/* Pakete */}
      {loading ? (
        <div className="text-center text-gray-400 animate-pulse">Lade Pakete...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const totalCoins = pkg.coins + pkg.bonus_coins;
            const priceEuro = (pkg.price_cents / 100).toFixed(2);
            const isBestValue = pkg.sort_order >= 4;

            return (
              <div
                key={pkg.id}
                className={`relative rounded-2xl border p-5 transition ${
                  isBestValue
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                {isBestValue && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-yellow-500 px-3 py-0.5 text-xs font-bold text-black">
                    Beliebt
                  </span>
                )}
                {pkg.bonus_coins > 0 && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    +{pkg.bonus_coins}
                  </span>
                )}

                <p className="text-lg font-semibold text-white">{pkg.name}</p>
                <p className="text-3xl font-bold text-yellow-400 mt-3">
                  {totalCoins.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Coins</p>
                {pkg.bonus_coins > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    inkl. {pkg.bonus_coins} Bonus-Coins
                  </p>
                )}

                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {purchasing === pkg.id ? "Kaufe..." : `${priceEuro} €`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-4 text-center text-sm">
          {message}
        </div>
      )}

      {/* Info */}
      <div className="mt-8 rounded-xl border border-dashed border-gray-700 p-4 text-xs text-gray-500">
        <p>💡 Coins verdienst du auch durch Spiele, tägliche Belohnungen und Challenges.</p>
        <p className="mt-1">Im echten System erfolgt die Zahlung via Stripe oder PayPal.</p>
      </div>
    </div>
  );
}