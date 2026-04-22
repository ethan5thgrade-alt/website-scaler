import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-dark-800 border border-red-500/40 rounded-lg text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="text-lg text-white mb-2">Something went wrong</div>
        <div className="text-sm text-gray-400 mb-5 font-mono break-all">
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button
          onClick={this.reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
        >
          Reload view
        </button>
      </div>
    );
  }
}
