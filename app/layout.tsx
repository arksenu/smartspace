import type { Metadata } from "next";
import "./globals.css";
import { ElectronAuthHandler } from "@/components/auth/electron-auth-handler";
import { UpdateNotification } from "@/components/ui/update-notification";

export const metadata: Metadata = {
  title: "SmartSpace - AI Knowledge Workspace",
  description: "A production-grade, AI-powered web application for document ingestion, semantic search, and LLM-powered reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ElectronAuthHandler />
        <UpdateNotification />
        {children}
      </body>
    </html>
  );
}
