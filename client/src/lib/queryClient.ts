import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): HeadersInit {
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) {
    return { Authorization: `Bearer ${adminToken}` };
  }
  
  const vendorToken = localStorage.getItem("vendor_token");
  if (vendorToken) {
    return { Authorization: `Bearer ${vendorToken}` };
  }
  
  return {};
}

let isRestoringSession = false;

export async function restoreVendorSession(): Promise<boolean> {
  if (isRestoringSession) return false;
  
  const vendorId = localStorage.getItem("vendor_id");
  const vendorToken = localStorage.getItem("vendor_token");
  
  if (!vendorId) {
    console.log("[restoreVendorSession] No vendor_id in localStorage");
    return false;
  }
  
  isRestoringSession = true;
  
  try {
    console.log("[restoreVendorSession] Attempting to restore session for vendor:", vendorId);
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (vendorToken) {
      headers["Authorization"] = `Bearer ${vendorToken}`;
    }
    
    const res = await fetch("/api/vendor/restore-session", {
      method: "POST",
      headers,
      body: JSON.stringify({ vendorId: parseInt(vendorId) }),
      credentials: "include",
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("vendor_token", data.token);
        if (data.vendor?.id) {
          localStorage.setItem("vendor_id", data.vendor.id.toString());
        }
        console.log("[restoreVendorSession] Session restored successfully");
        isRestoringSession = false;
        return true;
      }
    }
    
    console.log("[restoreVendorSession] Failed to restore session, status:", res.status);
    isRestoringSession = false;
    return false;
  } catch (error) {
    console.error("[restoreVendorSession] Error:", error);
    isRestoringSession = false;
    return false;
  }
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

  let res = await fetch(url, {
    method,
    headers,
    body: data && Object.keys(data).length > 0 ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && localStorage.getItem("vendor_id")) {
    console.log("[apiRequest] Got 401, attempting session restoration...");
    const restored = await restoreVendorSession();
    
    if (restored) {
      const newAuthHeaders = getAuthHeaders();
      const newHeaders: HeadersInit = {
        ...newAuthHeaders,
        "Content-Type": "application/json",
      };
      
      res = await fetch(url, {
        method,
        headers: newHeaders,
        body: data && Object.keys(data).length > 0 ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

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
