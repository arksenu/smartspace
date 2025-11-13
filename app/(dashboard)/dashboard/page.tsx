import { requireAuth } from "@/lib/auth/require-auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to SmartSpace</h1>
      <p className="text-muted-foreground">
        Your AI-powered knowledge workspace. Upload documents, chat with your data, and search semantically.
      </p>
    </div>
  );
}

