import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  handleReset = () => {
    // Clear potentially corrupted local data and reload
    try {
      localStorage.removeItem('dailyQuestsResetOnboarding');
      localStorage.removeItem('dailyQuestsOnboardingCompleted');
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl">⚠️</div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Что-то пошло не так</h1>
              <p className="text-gray-600 text-sm">
                Попробуйте перезагрузить приложение. Если ошибка повторится, обновите страницу.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-gray-400 mt-3 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-medium hover:from-purple-700 hover:to-cyan-700 transition-all"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}