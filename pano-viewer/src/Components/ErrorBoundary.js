import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8f8f8', 
          border: '1px solid #ddd',
          fontFamily: "'Inter', sans-serif"
        }}>
          <h2 style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: '300',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: '#9ca3af'
          }}>
            Something went wrong with the Panoviewer component.
          </h2>
          <details style={{ 
            whiteSpace: 'pre-wrap', 
            marginTop: '10px',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem'
          }}>
            <summary style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: '400',
              cursor: 'pointer',
              marginBottom: '10px',
              fontSize: '0.875rem'
            }}>
              Error Details (click to expand)
            </summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;