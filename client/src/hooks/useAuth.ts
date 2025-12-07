import { useQuery } from "@tanstack/react-query";
import type { CustomerUser } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<CustomerUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
