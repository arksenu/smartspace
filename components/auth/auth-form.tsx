"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Create client once using useMemo
  const supabase = useMemo(() => {
    try {
      const client = createClient();
      return client;
    } catch (error) {
      toast.error("Failed to initialize authentication. Please refresh the page.");
      return null;
    }
  }, []);

  const isElectron = typeof window !== "undefined" && (window as any).electronAPI;
  
  // Verify Supabase client on mount
  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession();
    }
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error("Authentication service not available. Please refresh the page.");
      return;
    }
    
    setLoading(true);

    try {
      if (mode === "signup") {
        const redirectTo = isElectron 
          ? `smartspace://auth/callback`
          : `${window.location.origin}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (error) {
          throw error;
        }

        toast.success("Check your email to confirm your account!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          throw new Error('No session returned from sign in');
        }

        // Wait for session to be saved to storage and cookies to be set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use window.location.replace for a full page reload
        // This ensures the server sees the new cookies
        window.location.replace("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    if (!supabase) {
      toast.error("Authentication service not available. Please refresh the page.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = isElectron 
        ? `smartspace://auth/callback`
        : `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Check your email for the magic link!");
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Sign In" : "Sign Up"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Enter your credentials to access your workspace"
            : "Create a new account to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}
          {mode === "login" && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Sign Up"}
          </Button>
        </form>
        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full mt-4"
            onClick={handleMagicLink}
            disabled={loading}
          >
            Magic Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

