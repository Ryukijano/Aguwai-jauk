import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, Calendar, TrendingUp, FileText, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useAIContextPublisher } from '@/contexts/AIPageContext';

export const Dashboard: React.FC = () => {
  const [location] = useLocation();
  const { publishContext } = useAIContextPublisher();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/me'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['/api/applications'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const stats = {
    totalJobs: jobs?.length || 0,
    applications: applications?.length || 0,
    interviews: applications?.filter((app: any) => app?.status === 'interview')?.length || 0,
    pending: applications?.filter((app: any) => app?.status === 'Pending')?.length || 0
  };

  // Publish context whenever data changes
  useEffect(() => {
    // Skip if still loading or no data
    if (userLoading || appsLoading || jobsLoading) return;
    
    try {
      const recentJobs = (jobs || []).slice(0, 5).map((job: any) => ({
        id: job?.id || 0,
        title: job?.title || 'Untitled Job',
        organization: job?.organization || 'Unknown Organization',
        location: job?.location,
        category: job?.category
      }));

      const recentApplications = (applications || []).slice(0, 5).map((app: any) => ({
        id: app?.id || 0,
        jobTitle: app?.jobTitle || 'Unknown Job',
        status: app?.status || 'Pending'
      }));

      publishContext({
        route: location,
        page: 'Dashboard',
        visibleSummary: {
          stats: {
            applications: stats.applications,
            interviews: stats.interviews,
            offers: applications?.filter((app: any) => app?.status === 'accepted')?.length || 0
          },
          jobs: recentJobs,
          totalJobs: stats.totalJobs,
          applications: recentApplications,
          totalApplications: stats.applications
        }
      });
    } catch (error) {
      console.debug('Failed to publish Dashboard context:', error);
    }
  }, [location, jobs, applications, stats.applications, stats.interviews, stats.totalJobs, publishContext, userLoading, appsLoading, jobsLoading]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back{user?.fullName || user?.username ? `, ${user?.fullName || user?.username}` : ''}!</h1>
        <p className="text-muted-foreground mt-2">
          Here's an overview of your job search progress
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground">+12% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.applications}</div>
            <p className="text-xs text-muted-foreground">{stats.pending} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.interviews}</div>
            <p className="text-xs text-muted-foreground">Next on Monday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">+19% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link href="/jobs">
            <Button>
              <Briefcase className="mr-2 h-4 w-4" />
              Browse Jobs
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Update Profile
            </Button>
          </Link>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Upload Resume
          </Button>
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {!applications || applications.length === 0 ? (
            <p className="text-muted-foreground">No applications yet. Start applying to jobs!</p>
          ) : (
            <div className="space-y-4">
              {(applications || []).slice(0, 5).map((app: any) => (
                <div key={app.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Application #{app?.id || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">
                      Applied on {app?.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    app?.status === 'interview' ? 'bg-green-100 text-green-700' :
                    app?.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {app?.status || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900">Profile Optimization</h4>
            <p className="text-sm text-blue-700 mt-1">
              Add your teaching certifications to increase profile views by 40%
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900">Trending Jobs</h4>
            <p className="text-sm text-green-700 mt-1">
              Primary school positions in Guwahati have increased by 25% this month
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-900">Interview Tip</h4>
            <p className="text-sm text-purple-700 mt-1">
              Practice classroom management scenarios - 80% of interviews include this topic
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};