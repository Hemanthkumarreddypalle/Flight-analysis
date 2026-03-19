import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import client from "./client";
import {
  hasOauthResponseInLocation,
  normalizeOauthResponseFromHash,
} from "./oauthRedirect";

const AUTH_REFRESH_TIMEOUT_MS = 8_000;
const SIGNIN_STARTED_MARKER = "osdk_signin_started";

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);
}

/**
 * Route guard for authenticated pages.
 * Refreshes token if available, otherwise routes to auth start/callback pages.
 */
function AuthenticatedRoute() {
  const [token, setToken] = useState(client.auth.getTokenOrUndefined());
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      normalizeOauthResponseFromHash();
      setAuthError(null);

      const current = client.auth.getTokenOrUndefined();
      if (current != null) {
        if (isMounted) {
          setToken(current);
        }
        return;
      }

      try {
        await runWithTimeout(client.auth.refresh(), AUTH_REFRESH_TIMEOUT_MS);
        const refreshed = client.auth.getTokenOrUndefined();
        if (isMounted && refreshed != null) {
          setToken(refreshed);
          return;
        }
      } catch {
        // fall through to auth navigation
      }

      if (!isMounted) {
        return;
      }

      if (hasOauthResponseInLocation()) {
        const query = window.location.search;
        const hash = window.location.hash;
        navigate(`/auth/callback${query}${hash}`, { replace: true });
        return;
      }

      // Prevent endless redirects by auto-starting OAuth only once.
      const signInStarted = sessionStorage.getItem(SIGNIN_STARTED_MARKER) === "1";
      if (signInStarted) {
        setAuthError("Sign-in did not complete. Click retry to continue.");
        return;
      }
      sessionStorage.setItem(SIGNIN_STARTED_MARKER, "1");
      navigate("/auth/start", { replace: true });
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (token == null) {
    if (authError != null) {
      return (
        <div style={{ padding: "1rem", textAlign: "left" }}>
          <h2>Authentication Error</h2>
          <p>{authError}</p>
          <button
            onClick={() => {
              sessionStorage.removeItem(SIGNIN_STARTED_MARKER);
              navigate("/auth/start", { replace: true });
            }}
          >
            Try Sign-In Again
          </button>
        </div>
      );
    }
    return <div style={{ padding: "1rem" }}>Authenticating…</div>;
  }

  return <Outlet />;
}

export default AuthenticatedRoute;
