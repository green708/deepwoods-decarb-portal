import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", this.props.label ?? "section", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <span className="font-semibold">{this.props.label ?? "This section"}</span> failed to load.
          Refresh the page or <a href="mailto:support@deepwoodsgreen.com" className="underline">contact support</a>.
        </div>
      );
    }
    return this.props.children;
  }
}
