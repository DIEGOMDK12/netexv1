import { useQuery } from "@tanstack/react-query";
import type { CustomerUser } from "@shared/schema";

async function fetchAuthUser(): Promise<CustomerUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });
  
  if (response.status === 401) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Auth check failed: ${response.status}`);
  }
  
  return await response.json();
}

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useQuery<CustomerUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchAuthUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = (returnTo?: string) => {
    const currentPath = returnTo || window.location.pathname + window.location.search;
    window.location.href = `/api/login?returnTo=${encodeURIComponent(currentPath)}`;
  };

  const logout = () => {
    window.location.href = "/api/logout";
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    refetch,
  };
}
