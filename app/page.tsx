import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";

export default async function Home() {
  const user = await getUser();

  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  // Otherwise show welcome/login page
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">SmartSpace</h1>
        <p className="text-lg mb-8">AI Knowledge Workspace</p>
        <div className="flex gap-4 justify-center">
          <a href="/login" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
            Sign In
          </a>
          <a href="/signup" className="px-4 py-2 border border-border rounded hover:bg-accent">
            Sign Up
          </a>
        </div>
      </div>
    </main>
  );
}

