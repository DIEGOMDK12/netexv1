import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): HeadersInit {
  // Priority 1: Check for admin token (admin login)
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) {
    console.log("[getAuthHeaders] Using admin token");
    return { Authorization: `Bearer ${adminToken}` };
  }
  
  // Priority 2: Check for vendor token (vendor login)
  const vendorToken = localStorage.getItem("vendor_token");
  if (vendorToken) {
    console.log("[getAuthHeaders] Using vendor token");
    return { Authorization: `Bearer ${vendorToken}` };
  }
  
  console.log("[getAuthHeaders] No token found");
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const headers: HeadersInit = {
    ...authHeaders,
    "Content-Type": "application/json",
  };

  console.log("[apiRequest] Method:", method);
  console.log("[apiRequest] URL:", url);
  console.log("[apiRequest] Has Authorization header?", 'Authorization' in authHeaders);

  const res = await fetch(url, {
    method,
    headers,
    body: data && Object.keys(data).length > 0 ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log("[apiRequest] Response status:", res.status);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
