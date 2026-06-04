import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a single bug (or a corrupt localStorage import)
 * shows a friendly recovery screen instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a real product this is where you'd report to an error service.
    console.error('Unhandled error:', error, info);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <div className="card" style={{ maxWidth: 460 }}>
            <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              The app hit an unexpected error. You can reload, or reset the stored data if it
              became corrupted.
            </p>
            <pre className="error-detail">{this.state.error.message}</pre>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn--primary" onClick={() => location.reload()}>
                Reload
              </button>
              <button className="btn btn--danger" onClick={this.handleReset}>
                Reset stored data
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
