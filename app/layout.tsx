import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
