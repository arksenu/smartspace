import { useAuth } from "@/components/providers/auth-provider";

export function useUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}

