"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Wallet, Transaction } from "@/types/monetization";

interface WalletState {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  fetchWallet: (userId: string) => Promise<void>;
  addCoins: (userId: string, amount: number, type: Transaction["type"], description: string, referenceId?: string) => Promise<boolean>;
  spendCoins: (userId: string, amount: number, type: Transaction["type"], description: string, referenceId?: string) => Promise<boolean>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  loading: false,
  error: null,

  fetchWallet: async (userId: string) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // Wenn keine Wallet existiert, leere Wallet anzeigen
      if (error.code === "PGRST116") {
        set({ wallet: null, loading: false });
        return;
      }
      set({ error: error.message, loading: false });
      return;
    }

    set({ wallet: data as Wallet, loading: false });
  },

  addCoins: async (userId, amount, type, description, referenceId) => {
    const supabase = createClient();
    const wallet = get().wallet;
    const currentBalance = wallet?.balance ?? 0;
    const newBalance = currentBalance + amount;

    // Wallet upsert + Transaktion
    const { error } = await supabase.from("user_wallets").upsert({
      user_id: userId,
      balance: newBalance,
      total_earned: (wallet?.total_earned ?? 0) + amount,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      set({ error: error.message });
      return false;
    }

    await supabase.from("transactions").insert({
      user_id: userId,
      amount,
      type,
      description,
      reference_id: referenceId ?? null,
      balance_after: newBalance,
    });

    set({ wallet: { ...wallet!, balance: newBalance, total_earned: (wallet?.total_earned ?? 0) + amount, updated_at: new Date().toISOString() } as Wallet });
    return true;
  },

  spendCoins: async (userId, amount, type, description, referenceId) => {
    const supabase = createClient();
    const wallet = get().wallet;
    const currentBalance = wallet?.balance ?? 0;

    if (currentBalance < amount) {
      set({ error: "Nicht genug Coins!" });
      return false;
    }

    const newBalance = currentBalance - amount;

    const { error } = await supabase.from("user_wallets").upsert({
      user_id: userId,
      balance: newBalance,
      total_spent: (wallet?.total_spent ?? 0) + amount,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      set({ error: error.message });
      return false;
    }

    await supabase.from("transactions").insert({
      user_id: userId,
      amount: -amount,
      type,
      description,
      reference_id: referenceId ?? null,
      balance_after: newBalance,
    });

    set({
      wallet: {
        ...wallet!,
        balance: newBalance,
        total_spent: (wallet?.total_spent ?? 0) + amount,
        updated_at: new Date().toISOString(),
      } as Wallet,
    });
    return true;
  },
}));