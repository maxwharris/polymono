import { Component } from 'react';
import { isChunkLoadError } from '../../lib/reload';

/**
 * Keeps the rest of the game usable if the 3D board fails (no WebGL, a lost context, a model that won't
 * load): the action panel, players and log still work. `onRetry` gives the board a fresh start (a new lazy
 * import, since lazy() keeps a failed one failed). If the board's code itself could not be fetched, the
 * game was most likely updated since this page loaded, and only a reload helps.
 */
export default class BoardBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Board failed:', error);
  }

  retry = () => {
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (isChunkLoadError(this.state.error)) {
      return (
        <div className="board-fallback" role="alert">
          <p>The game was updated since this page loaded.</p>
          <p className="board-fallback-sub">Reload to get the new version. You can still play from the panel below.</p>
          <button type="button" className="g-btn g-btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" className="g-btn g-btn--ghost" onClick={this.retry}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="board-fallback" role="alert">
        <p>The 3D board could not load on this device.</p>
        <p className="board-fallback-sub">You can still play from the panel below.</p>
        <button type="button" className="g-btn g-btn--secondary" onClick={this.retry}>
          Try again
        </button>
      </div>
    );
  }
}
