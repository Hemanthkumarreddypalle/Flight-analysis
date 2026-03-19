import { useEffect, useRef, useState } from "react";
import client, { clearOauthSessionStorage, clearOauthStorage } from "./client";

const SIGNIN_STARTED_MARKER = "osdk_signin_started";

function AuthStart() {
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    if (client.auth.getTokenOrUndefined() != null) {
      sessionStorage.removeItem(SIGNIN_STARTED_MARKER);
      window.location.replace("/");
      return;
    }
    clearOauthSessionStorage();
    void client.auth.signIn().catch((e: unknown) => {
      setError((e as Error).message ?? "Unable to start sign-in.");
    });
  }, []);

  if (error == null) {
    return <div style={{ padding: "1rem" }}>Redirecting to sign-in…</div>;
  }

  return (
    <div style={{ padding: "1rem", textAlign: "left" }}>
      <h2>Authentication Error</h2>
      <p>{error}</p>
      <button
        onClick={() => {
          clearOauthStorage();
          clearOauthSessionStorage();
          sessionStorage.removeItem(SIGNIN_STARTED_MARKER);
          void client.auth.signIn();
        }}
      >
        Try Sign-In Again
      </button>
    </div>
  );
}

export default AuthStart;
