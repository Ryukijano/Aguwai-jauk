import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import StatsGrid from "@/components/dashboard/StatsGrid";
import JobListingsSection from "@/components/dashboard/JobListingsSection";
import AIInsights from "@/components/dashboard/AIInsights";
import ProfileBio from "@/components/dashboard/ProfileBio";
import CalendarWidget from "@/components/dashboard/CalendarWidget";
import { Briefcase, FileText, CalendarCheck, Bell } from "lucide-react";
import { Stat, User, JobListing, Application, Event } from "@/lib/types";

const DashboardSafe = () => {
  // Use TanStack Query with the default queryFn configured in queryClient
  const { data: user } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const isLoading = jobsLoading;

  // Calculate upcoming deadlines safely
  const upcomingDeadlines = Array.isArray(jobs) ? jobs.filter(job => {
    if (!job?.applicationDeadline) return false;
    const deadline = new Date(job.applicationDeadline);
    const today = new Date();
    return deadline > today && ((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24)) <= 7;
  }).length : 0;

  // Get interview count safely
  const interviewCount = Array.isArray(applications) ? applications.filter(app => 
    app?.status === "Interview Scheduled" && app?.interviewDate
  ).length : 0;

  const stats: Stat[] = [
    {
      label: "Available Jobs",
      value: Array.isArray(jobs) ? jobs.length : 0,
      icon: "briefcase",
      color: "primary",
      trend: {
        value: "12%",
        direction: "up",
        label: "from last week"
      }
    },
    {
      label: "Applications",
      value: Array.isArray(applications) ? applications.length : 0,
      icon: "file-text",
      color: "secondary",
      trend: {
        value: "5%",
        direction: "up",
        label: "from last month"
      }
    },
    {
      label: "Interviews",
      value: interviewCount,
      icon: "calendar-check",
      color: "accent",
      trend: {
        value: "3",
        direction: "up",
        label: "scheduled"
      }
    },
    {
      label: "Notifications",
      value: upcomingDeadlines,
      icon: "bell",
      color: "warning",
      trend: {
        value: upcomingDeadlines > 0 ? `${upcomingDeadlines} deadlines` : "All clear",
        direction: upcomingDeadlines > 0 ? "down" : "up",
        label: "this week"
      }
    }
  ];

  const isLoadingJobs = isLoading;
  const isLoadingEvents = isLoading;

  return (
    <MainLayout>
      <div className="max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Welcome back, {user?.name || "Teacher"}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your job search today.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <StatsGrid stats={stats} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <JobListingsSection />
            <AIInsights />
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <ProfileBio />
            <CalendarWidget />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardSafe;