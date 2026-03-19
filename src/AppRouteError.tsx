import { isRouteErrorResponse, useRouteError } from "react-router-dom";

function AppRouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div style={{ padding: "1rem", textAlign: "left" }}>
        <h2>Route Error</h2>
        <p>
          {error.status} {error.statusText}
        </p>
        <p>
          <a href="/">Go to dashboard</a>
        </p>
      </div>
    );
  }

  const message = error instanceof Error ? error.message : String(error);

  return (
    <div style={{ padding: "1rem", textAlign: "left" }}>
      <h2>Route Error</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
      <p>
        <a href="/">Go to dashboard</a>
      </p>
    </div>
  );
}

export default AppRouteError;

