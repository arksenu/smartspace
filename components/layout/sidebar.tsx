"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, MessageSquare, Search, BarChart3, Settings, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: FileText },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen w-64 flex-col matte-panel border-r border-white/5 rounded-r-2xl">
      {/* Header */}
      <div className="flex h-20 items-center border-b border-white/5 px-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="absolute inset-0 animate-pulse-slow bg-primary/20 blur-md" />
          </div>
          <h1 className="text-xl font-semibold text-white/80 tracking-tight">
            SmartSpace
          </h1>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-white/10 text-primary border border-white/5"
                  : "text-[#8C8C92] hover:bg-white/5 hover:text-[#CFCFD3] border border-transparent"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
              )}
              <Icon className={cn(
                "h-4 w-4 transition-transform duration-200",
                isActive ? "text-primary" : ""
              )} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* Footer */}
      <div className="border-t border-white/5 p-4">
        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-white/10 transition-all duration-200 group text-[#8C8C92] hover:text-[#CFCFD3]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-0.5" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}

