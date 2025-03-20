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

      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/jobs">
        <ProtectedRoute component={JobListings} />
      </Route>
      <Route path="/applications">
        <ProtectedRoute component={Applications} />
      </Route>
      <Route path="/ai-assistant">
        <ProtectedRoute component={AIAssistant} />
      </Route>
      <Route path="/calendar">
        <ProtectedRoute component={Calendar} />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={Documents} />
      </Route>
      <Route path="/job-tracker">
        <ProtectedRoute component={JobTracker} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

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