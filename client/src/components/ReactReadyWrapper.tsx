import { ReactNode, Component } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isReady: boolean;
}

class ReactReadyWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isReady: false
    };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, isReady: false };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('React readiness check failed:', error, errorInfo);
  }

  componentDidMount() {
    // Test if React hooks are available
    try {
      // Simple check to see if React context is ready
      setTimeout(() => {
        this.setState({ isReady: true });
      }, 100);
    } catch (error) {
      console.warn('React hooks not ready:', error);
      this.setState({ hasError: true });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Loading application...</div>;
    }

    if (!this.state.isReady) {
      return <div>Loading application...</div>;
    }

    return this.props.children;
  }
}

export default ReactReadyWrapper;