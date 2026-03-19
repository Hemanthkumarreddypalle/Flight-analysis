import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client, { clearOauthStorage } from "./client";
import {
  hasOauthResponseInLocation,
  normalizeOauthResponseFromHash,
} from "./oauthRedirect";

const SIGNIN_STARTED_MARKER = "osdk_signin_started";

/**
 * Component to render at `/auth/callback`
 * This calls signIn() again to save the token, and then navigates the user back to the home page.
 */
function AuthCallback() {
  const [error, setError] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    normalizeOauthResponseFromHash();

    if (!hasOauthResponseInLocation()) {
      setError(
        "Authentication response missing in callback URL. Restart sign-in.",
      );
      return;
    }

    void client.auth
      .signIn()
      .then(() => {
        sessionStorage.removeItem(SIGNIN_STARTED_MARKER);
        navigate("/", { replace: true });
      })
      .catch((e: unknown) =>
        setError((e as Error).message ?? "Authentication failed."),
      );
  }, [navigate]);

  if (error == null) {
    return <div>Authenticating…</div>;
  }

  return (
    <div style={{ padding: "1rem", textAlign: "left" }}>
      <h2>Authentication Error</h2>
      <p>{error}</p>
      <button
        onClick={() => {
          clearOauthStorage();
          sessionStorage.removeItem(SIGNIN_STARTED_MARKER);
          navigate("/auth/start", { replace: true });
        }}
      >
        Try Sign-In Again
      </button>
    </div>
  );
}

export default AuthCallback;
