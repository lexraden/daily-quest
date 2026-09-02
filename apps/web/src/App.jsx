import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import SignIn from '@/components/SignIn';
import AnimatedRoutes from '@/components/navigation/AnimatedRoutes';
import ErrorBoundary from '@/components/ErrorBoundary';

const { Pages } = pagesConfig;

// Pages handled directly in AnimatedRoutes (tab pages)
const TAB_PAGES = ['DailyTracker', 'History', 'Profile', 'Home'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sign-in is rendered in place rather than redirected to: there is no hosted
  // login to leave for now that auth is ours.
  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <AnimatedRoutes fallback={<PageNotFound />}>
      {Object.entries(Pages)
        .filter(([path]) => !TAB_PAGES.includes(path))
        .map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={<Page />} />
        ))}
      <Route path="*" element={<PageNotFound />} />
    </AnimatedRoutes>
  );
};


function App() {

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
