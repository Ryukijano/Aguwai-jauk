import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth-provider";
import { ProtectedRoute } from "./lib/protected-route";

// Pages
import Dashboard from "@/pages/Dashboard";
import JobListings from "@/pages/JobListings";
import Applications from "@/pages/Applications";
import AIAssistant from "@/pages/AIAssistant";
import Calendar from "@/pages/Calendar";
import Documents from "@/pages/Documents";
import JobTracker from "@/pages/JobTracker";
import Profile from "@/pages/Profile";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/jobs" component={JobListings} />
      <ProtectedRoute path="/applications" component={Applications} />
      <ProtectedRoute path="/ai-assistant" component={AIAssistant} />
      <ProtectedRoute path="/calendar" component={Calendar} />
      <ProtectedRoute path="/documents" component={Documents} />
      <ProtectedRoute path="/job-tracker" component={JobTracker} />
      <ProtectedRoute path="/profile" component={Profile} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;