import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main
          style={{
            maxWidth: 560,
            margin: "12vh auto",
            padding: 24,
            lineHeight: 1.6,
          }}
        >
          <h1>PageKit couldn’t open this workspace.</h1>
          <p>
            Refresh the page to start a new session. Use a current version of
            Chrome, Edge, Firefox, or Safari.
          </p>
          <p>
            Your original files and completed downloads are still on your
            device. Unsaved workspace changes will be cleared.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "12px 20px", font: "inherit" }}
          >
            Start a new session
          </button>
        </main>
      );
    return this.props.children;
  }
}
