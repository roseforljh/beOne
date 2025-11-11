import { Component } from 'react';
import TaijiLogo from './TaijiLogo';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-taiji-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <TaijiLogo size={80} animate={true} />
            </div>
            <h1 className="text-2xl font-bold text-taiji-black mb-4">
              页面加载失败
            </h1>
            <p className="text-taiji-gray-600 mb-6">
              {this.state.error?.message || '发生了一个错误'}
            </p>
            <button
              onClick={this.handleReload}
              className="w-full px-6 py-3 bg-taiji-black text-white rounded-lg hover:bg-taiji-gray-800 transition-colors font-medium"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;