import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  /** Do not default to `getLoginUrl()` here — it would run on every mount and is unnecessary when `redirectOnUnauthenticated` is false. */
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    utils.auth.me.setData(undefined, null);
    try {
      await logoutMutation.mutateAsync(undefined);
    } catch (error) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Session already cleared on server or client.
      } else {
        console.error("[auth.logout] mutation failed", error);
      }
    }

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    /** After login, `me` can be cached `null` while refetching; `isLoading` stays false in TanStack Query v5. */
    const loading =
      meQuery.isPending ||
      logoutMutation.isPending ||
      (meQuery.fetchStatus === "fetching" && meQuery.data == null);
    return {
      user: meQuery.data ?? null,
      loading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isPending,
    meQuery.fetchStatus,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    const target = redirectPath ?? getLoginUrl();
    if (target.startsWith("/")) {
      if (window.location.pathname === target) return;
    } else if (window.location.href === target) {
      return;
    }

    window.location.href = target;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
