import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex h-screen bg-[#0F0F12] relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 -z-10 noise opacity-10" />
        
        {/* Animated gradient orbs - soft */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/3 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Top gradient overlay */}
        <div className="fixed top-0 left-0 right-0 h-40 gradient-top pointer-events-none z-0" />
        
        <Sidebar />
        <main className="flex-1 overflow-auto relative p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </AuthProvider>
  );
}

