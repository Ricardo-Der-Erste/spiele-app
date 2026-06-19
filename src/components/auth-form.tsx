"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Client nur im Browser initialisieren (env vars nur dort verfügbar)
    const supabase = createClient();

    try {
      if (mode === "register") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });
        if (signUpError) throw signUpError;
        // Registration erfolgreich – E-Mail ist raus
        router.push("/?registered=true");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Etwas ist schief gelaufen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-sm space-y-5">
      <h1 className="text-center text-2xl font-bold text-white">
        {mode === "login" ? "Willkommen zurück 👋" : "Erstelle deinen Account 🚀"}
      </h1>

      {error && (
        <div className="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {mode === "register" && (
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300">
            Benutzername
          </label>
          <input
            id="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            placeholder="spieler42"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
          placeholder="ich@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
          placeholder="••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading
          ? "Wird geladen..."
          : mode === "login"
            ? "Anmelden"
            : "Registrieren"}
      </button>

      <p className="text-center text-sm text-gray-400">
        {mode === "login" ? (
          <>
            Kein Account?{" "}
            <a href="/register" className="text-indigo-400 hover:underline">
              Jetzt registrieren
            </a>
          </>
        ) : (
          <>
            Bereits registriert?{" "}
            <a href="/login" className="text-indigo-400 hover:underline">
              Jetzt anmelden
            </a>
          </>
        )}
      </p>
    </form>
  );
}