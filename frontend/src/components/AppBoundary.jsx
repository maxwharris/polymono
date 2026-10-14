import { Component } from 'react';

/** Last line of defence: a rendering bug shows a reload screen instead of a blank page. */
export default class AppBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="splash" role="alert">
        <p className="splash-text">Something went wrong on this screen.</p>
        <div className="splash-actions splash-actions--now">
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
