import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth-provider";

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

// Components
import AIChatPopup from "@/components/ai/AIChatPopup";

function Router() {
  return (
    <Switch>
      {/* Temporarily render Dashboard directly */}
      <Route path="/" component={Dashboard} />

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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <AIChatPopup />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;