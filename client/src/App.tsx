import React, { useState, useEffect } from 'react';
import { Router, Route, Switch, Link, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, FileText, User, LogOut, Menu, X } from 'lucide-react';

// Pages
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Jobs } from '@/pages/Jobs';
import { JobDetails } from '@/pages/JobDetails';
import { Applications } from '@/pages/Applications';
import { Profile } from '@/pages/Profile';

// Components
import { AiAssistant } from '@/components/AiAssistant';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Main Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null));
  }, [location]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setLocation('/login');
  };

  const isActive = (path: string) => location === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard">
                <a className="flex items-center space-x-2">
                  <Briefcase className="h-8 w-8 text-blue-600" />
                  <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
                    Teacher Job Portal - Assam
                  </h1>
                  <h1 className="text-xl font-bold text-gray-900 sm:hidden">
                    TJP Assam
                  </h1>
                </a>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link href="/dashboard">
                <Button variant={isActive('/dashboard') ? 'default' : 'ghost'} size="sm">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/jobs">
                <Button variant={isActive('/jobs') ? 'default' : 'ghost'} size="sm">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Jobs
                </Button>
              </Link>
              <Link href="/applications">
                <Button variant={isActive('/applications') ? 'default' : 'ghost'} size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Applications
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant={isActive('/profile') ? 'default' : 'ghost'} size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
              </Link>
              {user && (
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link href="/dashboard">
                <Button
                  variant={isActive('/dashboard') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/jobs">
                <Button
                  variant={isActive('/jobs') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Jobs
                </Button>
              </Link>
              <Link href="/applications">
                <Button
                  variant={isActive('/applications') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Applications
                </Button>
              </Link>
              <Link href="/profile">
                <Button
                  variant={isActive('/profile') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
              </Link>
              {user && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* AI Assistant */}
      {user && <AiAssistant />}
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/dashboard">
            <Layout>
              <Dashboard />
            </Layout>
          </Route>
          <Route path="/jobs">
            <Layout>
              <Jobs />
            </Layout>
          </Route>
          <Route path="/jobs/:id">
            <Layout>
              <JobDetails />
            </Layout>
          </Route>
          <Route path="/applications">
            <Layout>
              <Applications />
            </Layout>
          </Route>
          <Route path="/profile">
            <Layout>
              <Profile />
            </Layout>
          </Route>
          <Route>
            {/* Default redirect to login */}
            <Login />
          </Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
};

export default App;