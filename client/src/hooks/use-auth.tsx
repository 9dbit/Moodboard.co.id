import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (details: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || result?.error || "Unable to complete this request. Please try again.");
  }
  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const { data: user = null, isPending, error, refetch } = useQuery<AuthUser | null, Error>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await fetch("/api/me", { credentials: "include" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("We could not check your session. Please try again.");
      return response.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    retry: false,
  });

  async function authenticate(path: string, body: Record<string, unknown>) {
    await authRequest(path, body);
    const response = await fetch("/api/me", { credentials: "include" });
    if (!response.ok) throw new Error("Your session could not be started. Please sign in again.");
    const authenticatedUser: AuthUser = await response.json();
    await client.cancelQueries();
    // Keep the observed session query while removing the previous account's data.
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "/api/me" });
    client.setQueryData(["/api/me"], authenticatedUser);
  }

  async function signOut(options?: { redirectUrl?: string }) {
    try {
      await authRequest("/api/auth/logout", {});
      await client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "/api/me" });
      client.setQueryData(["/api/me"], null);
      window.location.assign(options?.redirectUrl || import.meta.env.BASE_URL);
    } catch (error) {
      toast({ title: "Could not log out", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading: isPending,
      error,
      retry: () => { void refetch(); },
      signIn: (email, password) => authenticate("/api/auth/login", { email, password }),
      signUp: (details) => authenticate("/api/auth/register", details),
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
