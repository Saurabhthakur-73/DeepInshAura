import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DeepInshAura",
  description: "AI-powered document analysis system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <div className="flex min-h-screen bg-gray-100">
          <Sidebar />
          <div className="flex-1 md:ml-64 ml-0">
            <Header />
            <main className="p-3 md:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}