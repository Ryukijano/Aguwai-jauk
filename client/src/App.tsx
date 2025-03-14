import { Switch, Route, Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

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

// Auth guard component
const PrivateRoute = ({ component: Component, ...rest }: { component: React.ComponentType<any>, path: string }) => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const [location] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  return <Component {...rest} />;
};

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <PrivateRoute component={Dashboard} path="/" />
      </Route>
      
      <Route path="/jobs">
        <PrivateRoute component={JobListings} path="/jobs" />
      </Route>
      
      <Route path="/applications">
        <PrivateRoute component={Applications} path="/applications" />
      </Route>
      
      <Route path="/ai-assistant">
        <PrivateRoute component={AIAssistant} path="/ai-assistant" />
      </Route>
      
      <Route path="/calendar">
        <PrivateRoute component={Calendar} path="/calendar" />
      </Route>
      
      <Route path="/documents">
        <PrivateRoute component={Documents} path="/documents" />
      </Route>
      
      <Route path="/job-tracker">
        <PrivateRoute component={JobTracker} path="/job-tracker" />
      </Route>
      
      <Route path="/profile">
        <PrivateRoute component={Profile} path="/profile" />
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
