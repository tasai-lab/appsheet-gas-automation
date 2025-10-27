import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ClientsProvider } from "@/contexts/ClientsContext";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "F Assistant",
  description: "フラクタルのRAG検索ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            <ClientsProvider>{children}</ClientsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
