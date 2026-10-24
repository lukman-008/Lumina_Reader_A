import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Lumina Sanctuary ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center space-y-4 shadow-xl">
            <h2 className="font-display text-lg font-semibold">
              View Recovery Activated
            </h2>
            <p className="text-xs opacity-75 leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onReset?.();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-700 hover:bg-amber-600 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Return to Library Sanctuary</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
