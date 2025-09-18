import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Briefcase, Users, Calendar, TrendingUp, FileText, Bell, MapPin, Award, Clock, ChevronRight, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useAIContextPublisher } from '@/contexts/AIPageContext';
import type { User, JobListing, Application, JobMatch } from '@shared/schema';

export const Dashboard: React.FC = () => {
  const [location] = useLocation();
  const { publishContext } = useAIContextPublisher();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/me'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobListing[]>({
    queryKey: ['/api/jobs'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const { data: jobMatches = [], isLoading: matchesLoading } = useQuery<JobMatch[]>({
    queryKey: ['/api/resume/job-matches'],
    enabled: !!user,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  const stats = {
    totalJobs: jobs.length,
    applications: applications.length,
    interviews: applications.filter((app) => app.status === 'interview').length,
    pending: applications.filter((app) => app.status === 'Pending').length
  };

  // Publish context whenever data changes
  useEffect(() => {
    // Skip if still loading or no data
    if (userLoading || appsLoading || jobsLoading) return;
    
    try {
      const recentJobs = jobs.slice(0, 5).map((job) => ({
        id: job.id,
        title: job.title,
        organization: job.organization,
        location: job.location || undefined,
        category: job.category || undefined
      }));

      const recentApplications = applications.slice(0, 5).map((app) => ({
        id: app.id,
        jobTitle: 'Job #' + app.jobId,
        status: app.status
      }));

      publishContext({
        route: location,
        page: 'Dashboard',
        visibleSummary: {
          stats: {
            applications: stats.applications,
            interviews: stats.interviews,
            offers: applications.filter((app) => app.status === 'accepted').length
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
        <h1 className="text-3xl font-bold">Welcome back{user?.fullName || user?.username ? `, ${user.fullName || user.username}` : ''}!</h1>
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

      {/* Recommended Jobs Section */}
      {!matchesLoading && jobMatches.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Recommended Jobs for You
              </CardTitle>
              <Link href="/jobs?filter=matches">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobMatches.slice(0, 5).map((match) => {
              const job = jobs.find((j) => j.id === match.jobId);
              if (!job) return null;
              
              return (
                <div key={match.jobId} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                  <Link href={`/jobs/${job.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{job.title}</h3>
                          <Badge 
                            variant={match.matchScore >= 80 ? "default" : match.matchScore >= 60 ? "secondary" : "outline"}
                            className={`${match.matchScore >= 80 ? 'bg-green-500' : match.matchScore >= 60 ? 'bg-yellow-500' : 'bg-gray-500'} text-white`}
                          >
                            {match.matchScore}% Match
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {job.organization && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {job.organization}
                            </span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </span>
                          )}
                          {job.category && (
                            <span className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              {job.category}
                            </span>
                          )}
                        </div>
                        <Progress value={match.matchScore} className="h-2 w-full max-w-xs" />
                        <div className="space-y-1">
                          {match.matchReasons?.slice(0, 2).map((reason, idx) => (
                            <p key={idx} className="text-sm text-green-600 dark:text-green-400">✓ {reason}</p>
                          ))}
                          {match.missingQualifications && match.missingQualifications.length > 0 && (
                            <p className="text-sm text-muted-foreground">Missing: {match.missingQualifications[0]}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="text-xs">
                          {match.recommendationLevel === 'perfect' ? 'Perfect Match' :
                           match.recommendationLevel === 'strong' ? 'Strong Match' :
                           match.recommendationLevel === 'moderate' ? 'Good Match' : 'Worth Exploring'}
                        </Badge>
                        {job.applicationDeadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(job.applicationDeadline) > new Date() ? 
                              `${Math.ceil((new Date(job.applicationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left` :
                              'Expired'
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
            {jobMatches.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No job matches yet</p>
                <p className="text-sm mt-1">Upload your resume to get personalized job recommendations</p>
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="mt-4">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Resume
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          <Link href="/profile">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Upload Resume
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-muted-foreground">No applications yet. Start applying to jobs!</p>
          ) : (
            <div className="space-y-4">
              {applications.slice(0, 5).map((app) => (
                <div key={app.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Application #{app.id}</p>
                    <p className="text-sm text-muted-foreground">
                      Applied on {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    app.status === 'interview' ? 'bg-green-100 text-green-700' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {app.status}
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