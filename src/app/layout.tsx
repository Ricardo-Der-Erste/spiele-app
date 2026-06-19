import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/components/auth-provider";
import { DailyRewardPopup } from "@/components/daily-reward";

export const metadata: Metadata = {
  title: "SpieleHub – Spieleplattform",
  description: "Mobile-first Spieleplattform mit Next.js, Phaser und Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-950 text-white antialiased" suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <DailyRewardPopup />
        </AuthProvider>
      </body>
    </html>
  );
}