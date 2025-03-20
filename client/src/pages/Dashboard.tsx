import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import StatsGrid from "@/components/dashboard/StatsGrid";
import JobListingsSection from "@/components/dashboard/JobListingsSection";
import AIInsights from "@/components/dashboard/AIInsights";
import ProfileBio from "@/components/dashboard/ProfileBio";
import CalendarWidget from "@/components/dashboard/CalendarWidget";
import AIChatWidget from "@/components/dashboard/AIChatWidget";
import { Briefcase, FileText, CalendarCheck, Bell } from "lucide-react";
import { Stat, User, JobListing, Application, Event } from "@/lib/types";

const Dashboard = () => {
  // Provide default values and proper error handling for queries
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false // Don't retry on auth failures
  });

  const { data: jobs = [], error: jobsError } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
    retry: false
  });

  const { data: applications = [], error: applicationsError } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    retry: false
  });

  const { data: events = [], error: eventsError } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    retry: false
  });

  // Calculate upcoming deadlines safely
  const upcomingDeadlines = jobs.filter(job => {
    const deadline = new Date(job.applicationDeadline);
    const today = new Date();
    return deadline > today && ((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24)) <= 7;
  }).length;

  // Get interview count safely
  const interviewCount = applications.filter(app => 
    app.status === "Interview Scheduled" && app.interviewDate
  ).length;

  const stats: Stat[] = [
    {
      label: "Available Jobs",
      value: jobs.length,
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
      value: applications.length,
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
        value: `Next: ${events.length > 0 ? new Date(events[0].startTime).toLocaleDateString() : 'None'}`,
        direction: "neutral",
        label: ""
      }
    },
    {
      label: "Deadlines",
      value: upcomingDeadlines,
      icon: "bell",
      color: "red",
      trend: {
        value: upcomingDeadlines > 0 ? "Closest: 3 days" : "None upcoming",
        direction: "down",
        label: ""
      }
    }
  ];

  return (
    <MainLayout>
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2 text-white">Welcome back, {user?.name || "Teacher"}</h1>
            <p className="text-gray-900 font-medium">
              You have {applications.length} pending applications and {jobs.length} new teaching jobs matching your profile.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button className="bg-white text-primary-600 hover:bg-primary-50 font-medium px-4 py-2 rounded-lg flex items-center transition">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
                />
              </svg>
              Upload Resume
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsGrid stats={stats} />

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Recent Job Listings and AI Insights */}
        <div className="lg:col-span-2 space-y-6">
          <JobListingsSection limit={3} showFilters={true} showViewAll={true} />
          <AIInsights />
        </div>

        {/* Right Column - Profile, Calendar and AI Chat */}
        <div className="space-y-6">
          <ProfileBio />
          <CalendarWidget />
          <AIChatWidget />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;