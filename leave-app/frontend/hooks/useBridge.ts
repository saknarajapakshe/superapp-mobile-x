import { useState, useEffect, useCallback } from "react";

interface BridgeState {
  token: string | null;
  isReady: boolean;
}

export const useBridge = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const inHost =
    typeof (window as any).nativebridge?.requestToken === "function";

  useEffect(() => {
    const run = async () => {
      // Use env-based default dev token when not running in a host environment.
      const defaultDevToken =
        (import.meta as any).env?.VITE_DEV_TOKEN || "dev-token-123";
      if (!inHost) {
        console.warn("Bridge not found. Using dev token.");
        setToken(defaultDevToken);
        setIsReady(true);
        return;
      }
      try {
        const fetchedToken = await (window as any).nativebridge.requestToken();
        setToken(fetchedToken);
      } catch (e) {
        console.error("requestToken failed", e);
        // Fall back to environment token if available
        setToken(defaultDevToken);
      } finally {
        setIsReady(true);
      }
    };
    run();
  }, [inHost]);

  const requestToken = useCallback(async () => {
    if (inHost) {
      return (window as any).nativebridge.requestToken();
    }
    return "dev-token-123";
  }, [inHost]);

  const requestDownloadFile = useCallback(
    async (options: { url?: string; filename?: string; base64?: string }) => {
      if (inHost) {
        return (window as any).nativebridge.requestDownloadFile(options);
      }
    },
    [inHost]
  );

  return { token, isReady, requestToken, requestDownloadFile };
};
