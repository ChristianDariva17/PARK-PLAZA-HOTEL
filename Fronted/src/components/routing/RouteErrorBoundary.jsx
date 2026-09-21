import { Component } from 'react';

export default class RouteErrorBoundary extends Component {
  state = { error: null };

  retry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div className="route-error state-panel state-error" role="alert"><h2>No se pudo cargar este módulo</h2><p>Recargá la página o volvé a intentarlo desde la navegación.</p><button className="btn btn-primary" onClick={this.retry}>Reintentar módulo</button></div>;
    }
    return this.props.children;
  }
}
