import React from "react";

type ErrorViewProps = { error: Error };

function ErrorView({ error }: ErrorViewProps) {
  return (
    <div style={{ padding: "1rem", fontFamily: "monospace", textAlign: "left" }}>
      <h2>Application Startup Error</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
      {error.stack != null ? (
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.stack}</pre>
      ) : null}
    </div>
  );
}

type StartupErrorBoundaryState = { error: Error | null };

class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  StartupErrorBoundaryState
> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("Startup error:", error);
  }

  render() {
    if (this.state.error != null) {
      return <ErrorView error={this.state.error} />;
    }

    return this.props.children;
  }
}

export default StartupErrorBoundary;

