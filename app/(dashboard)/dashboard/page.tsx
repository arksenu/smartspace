import { requireAuth } from "@/lib/auth/require-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare, Search, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await requireAuth();

  const features = [
    {
      icon: FileText,
      title: "Document Management",
      description: "Upload and organize your documents with intelligent indexing",
      href: "/documents",
      gradient: "from-blue-500/20 to-cyan-500/20",
    },
    {
      icon: MessageSquare,
      title: "AI Chat",
      description: "Chat with your documents using advanced AI reasoning",
      href: "/chat",
      gradient: "from-purple-500/20 to-pink-500/20",
    },
    {
      icon: Search,
      title: "Semantic Search",
      description: "Find information instantly with semantic understanding",
      href: "/search",
      gradient: "from-orange-500/20 to-red-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="space-y-2 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white/80">
            Welcome to{" "}
            <span className="gradient-text">SmartSpace</span>
          </h1>
        </div>
        <p className="text-sm text-[#8C8C92] max-w-2xl">
          Your AI-powered knowledge workspace. Upload documents, chat with your data, and search semantically.
        </p>
      </div>

      {/* Feature Cards - Compact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href}>
              <Card className="group relative overflow-hidden card-depth-hover hover:border-primary/30 transition-all duration-200">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors border border-primary/20 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#8C8C92] group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5" />
                  </div>
                  <CardTitle className="text-sm font-medium mb-1 group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="card-depth animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-medium mb-1">Get Started</CardTitle>
              <CardDescription className="text-xs">
                Start by uploading your first document or jump into a conversation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" className="group h-8 text-xs">
                <Link href="/documents">
                  Upload
                  <ArrowRight className="ml-1.5 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="group h-8 text-xs">
                <Link href="/chat">
                  Chat
                  <MessageSquare className="ml-1.5 h-3 w-3 group-hover:scale-110 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

