import { Component } from 'react';

// Waits before each retry of a failed download (a phone that slept mid-load, a flaky network).
const RETRY_MS = [500, 4000, 15000];

/**
 * Renders `fallback` instead of children that threw (a missing texture or model must not blank the app).
 * With `clearCache` (drops the failed download from the loader's cache, which otherwise rethrows the same
 * error forever), it tries the children again a few times.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    const { label, clearCache } = this.props;
    const delay = clearCache ? RETRY_MS[this.state.attempt] : undefined;
    console.warn(`[board] ${label || 'component'} failed, showing a fallback${delay != null ? ' and retrying' : ''}:`, error?.message || error);
    if (delay == null) return;
    clearCache();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.setState(s => ({ error: null, attempt: s.attempt + 1 })), delay);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    return this.state.error ? (this.props.fallback ?? null) : this.props.children;
  }
}
