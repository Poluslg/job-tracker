import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@job-ai/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {

    console.error('[career-copilot] UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="p-5">
        <p className="text-sm font-semibold text-fg">Something broke in the interface.</p>
        <p className="mt-1 text-xs text-fg-muted">
          Your saved data is untouched. Reloading usually clears this.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-surface-muted p-2 text-[10px] text-fg-muted">
          {error.message}
        </pre>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
