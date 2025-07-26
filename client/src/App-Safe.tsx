import { StrictMode, Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

// Create a fresh QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Lazy load pages to avoid immediate hook calls
const DashboardSafe = lazy(() => import("@/pages/DashboardSafe"));
const JobListings = lazy(() => import("@/pages/JobListings"));
const Applications = lazy(() => import("@/pages/Applications"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Documents = lazy(() => import("@/pages/Documents"));
const JobTracker = lazy(() => import("@/pages/JobTracker-Safe"));
const Profile = lazy(() => import("@/pages/Profile"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AIChatPopup = lazy(() => import("@/components/ai/AIChatPopup"));

// Loading component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-lg">Loading...</div>
  </div>
);

// Simple auth provider without hooks
const SimpleAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

function Router() {
  return (
    <Suspense fallback={<Loading />}>
      <Switch>
        <Route path="/" component={DashboardSafe} />
        <Route path="/jobs" component={JobListings} />
        <Route path="/applications" component={Applications} />
        <Route path="/ai-assistant" component={AIAssistant} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/documents" component={Documents} />
        <Route path="/job-tracker" component={JobTracker} />
        <Route path="/profile" component={Profile} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppSafe() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SimpleAuthProvider>
          <Router />
          <Suspense fallback={null}>
            <AIChatPopup />
          </Suspense>
          <Toaster />
        </SimpleAuthProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

export default AppSafe;