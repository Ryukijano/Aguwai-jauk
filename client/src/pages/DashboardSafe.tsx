import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import StatsGrid from "@/components/dashboard/StatsGrid";
import JobListingsSection from "@/components/dashboard/JobListingsSection";
import AIInsights from "@/components/dashboard/AIInsights";
import ProfileBio from "@/components/dashboard/ProfileBio";
import CalendarWidget from "@/components/dashboard/CalendarWidget";
import { Briefcase, FileText, CalendarCheck, Bell } from "lucide-react";
import { Stat, User, JobListing, Application, Event } from "@/lib/types";

const DashboardSafe = () => {
  // Use simple state instead of useQuery initially
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch data manually without useQuery
    const fetchData = async () => {
      try {
        // Fetch user
        try {
          const userRes = await fetch("/api/auth/user", { credentials: "include" });
          if (userRes.ok) {
            setUser(await userRes.json());
          }
        } catch (e) {
          console.log("User not authenticated");
        }

        // Fetch jobs
        try {
          const jobsRes = await fetch("/api/jobs", { credentials: "include" });
          if (jobsRes.ok) {
            setJobs(await jobsRes.json());
          }
        } catch (e) {
          console.error("Failed to fetch jobs", e);
        }

        // Fetch applications
        try {
          const appsRes = await fetch("/api/applications", { credentials: "include" });
          if (appsRes.ok) {
            setApplications(await appsRes.json());
          }
        } catch (e) {
          console.log("Failed to fetch applications");
        }

        // Fetch events
        try {
          const eventsRes = await fetch("/api/events", { credentials: "include" });
          if (eventsRes.ok) {
            setEvents(await eventsRes.json());
          }
        } catch (e) {
          console.log("Failed to fetch events");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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
            <JobListingsSection 
              jobs={jobs} 
              isLoading={isLoadingJobs}
            />
            <AIInsights />
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <ProfileBio user={user} />
            <CalendarWidget 
              events={events} 
              isLoading={isLoadingEvents}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardSafe;