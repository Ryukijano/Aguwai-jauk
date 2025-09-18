import React, { useState, useEffect } from 'react';
import { useAIContextPublisher } from '@/contexts/AIPageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar, Building, MapPin, FileText, Clock, Filter, TrendingUp, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, ApplicationStatus, getStatusDescription } from '@/components/StatusBadge';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Application, JobListing } from '@shared/schema';

export const Applications: React.FC = () => {
  const { publishContext } = useAIContextPublisher();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  
  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });
  
  const { data: jobListings = [], isLoading: jobsLoading } = useQuery<JobListing[]>({
    queryKey: ['/api/jobs'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });
  
  // Get job details for each application
  const applicationsWithJobs = (applications || []).map((app) => {
    const job = jobListings?.find((j) => j?.id === app?.jobId);
    return {
      ...app,
      job
    };
  });
  
  // Filter applications
  const filteredApplications = (applicationsWithJobs || []).filter((app) => {
    if (!app) return false;
    if (statusFilter === 'all') return true;
    const normalizedStatus = (app?.status || 'pending').toLowerCase().replace(' ', '_');
    return normalizedStatus === statusFilter;
  });
  
  // Sort applications
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.appliedAt || '').getTime();
    const dateB = new Date(b.updatedAt || b.appliedAt || '').getTime();
    return sortBy === 'recent' ? dateB - dateA : dateA - dateB;
  });
  
  // Group applications by status
  const groupedApplications = {
    pending: sortedApplications.filter(app => (app?.status || '').toLowerCase() === 'pending' || !app?.status),
    under_review: sortedApplications.filter(app => (app?.status || '').toLowerCase() === 'under_review'),
    shortlisted: sortedApplications.filter(app => (app?.status || '').toLowerCase() === 'shortlisted' || (app?.status || '').toLowerCase() === 'interview'),
    rejected: sortedApplications.filter(app => (app?.status || '').toLowerCase() === 'rejected'),
    accepted: sortedApplications.filter(app => (app?.status || '').toLowerCase() === 'accepted')
  };
  
  const statusCounts = {
    all: applications?.length || 0,
    pending: groupedApplications.pending?.length || 0,
    under_review: groupedApplications.under_review?.length || 0,
    shortlisted: groupedApplications.shortlisted?.length || 0,
    rejected: groupedApplications.rejected?.length || 0,
    accepted: groupedApplications.accepted?.length || 0
  };
  
  const successRate = applications?.length > 0 
    ? Math.round((groupedApplications.accepted?.length / applications?.length) * 100)
    : 0;
  
  // Publish context when data or filters change
  useEffect(() => {
    // Skip if still loading or no data
    if (isLoading || jobsLoading) return;
    
    try {
      const visibleApplications = (sortedApplications || []).slice(0, 5).map((app) => ({
        id: app?.id || 0,
        jobTitle: app?.job?.title || `Application #${app?.id || 'N/A'}`,
        status: app?.status || 'Pending'
      }));
      
      publishContext({
        route: window.location.pathname,
        page: 'Applications',
        visibleSummary: {
          applications: visibleApplications,
          totalApplications: applications?.length || 0,
          filters: {
            query: statusFilter !== 'all' ? statusFilter : undefined
          },
          stats: {
            applications: applications?.length || 0,
            interviews: statusCounts.shortlisted,
            offers: statusCounts.accepted
          }
        }
      });
    } catch (error) {
      console.debug('Failed to publish Applications context:', error);
    }
  }, [sortedApplications, applications?.length, statusFilter, statusCounts, publishContext, isLoading, jobsLoading]);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your job applications
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {statusCounts.pending} pending review
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.pending + statusCounts.under_review + statusCounts.shortlisted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In progress
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.shortlisted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Shortlisted
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {successRate}%
              {successRate > 0 && <TrendingUp className="w-4 h-4 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statusCounts.accepted} accepted
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}>
          <TabsList data-testid="status-filter-tabs">
            <TabsTrigger value="all" data-testid="filter-all">
              All ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="filter-pending">
              Pending ({statusCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="under_review" data-testid="filter-under-review">
              Review ({statusCounts.under_review})
            </TabsTrigger>
            <TabsTrigger value="shortlisted" data-testid="filter-shortlisted">
              Shortlisted ({statusCounts.shortlisted})
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="filter-rejected">
              Rejected ({statusCounts.rejected})
            </TabsTrigger>
            <TabsTrigger value="accepted" data-testid="filter-accepted">
              Accepted ({statusCounts.accepted})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Select value={sortBy} onValueChange={(v: 'recent' | 'oldest') => setSortBy(v)}>
          <SelectTrigger className="w-[180px]" data-testid="sort-select">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent" data-testid="sort-recent">Most Recent</SelectItem>
            <SelectItem value="oldest" data-testid="sort-oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Applications List */}
      <div className="space-y-4">
        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading applications...
            </CardContent>
          </Card>
        )}
        
        {!isLoading && applications.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>You haven't applied to any jobs yet.</p>
              <Button className="mt-4" asChild>
                <Link href="/jobs">Browse Jobs</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        
        {sortedApplications.map((application) => {
          const normalizedStatus = ((application.status || 'pending').toLowerCase().replace(' ', '_')) as ApplicationStatus;
          
          return (
            <Card 
              key={application.id} 
              className="hover:shadow-lg transition-shadow duration-200"
              data-testid={`application-card-${application.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {application.job?.title || `Application #${application.id}`}
                        </h3>
                        {application.job && (
                          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building className="w-4 h-4" />
                              {application.job.organization}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {application.job.location}
                            </span>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={normalizedStatus} showIcon={true} />
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {getStatusDescription(normalizedStatus)}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Applied {application.appliedAt ? format(new Date(application.appliedAt), 'MMM d, yyyy') : 'N/A'}
                        </span>
                        
                        {application.updatedAt && application.updatedAt !== application.appliedAt && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            Updated {format(new Date(application.updatedAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      
                      {application.interviewDate && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Interview scheduled: {format(new Date(application.interviewDate), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      )}
                      
                      {application.notes && (
                        <div className="mt-3 p-3 bg-muted rounded-lg">
                          <p className="text-sm">{application.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/applications/${application.id}`} data-testid={`view-details-${application.id}`}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Timeline
                      </Link>
                    </Button>
                    {application.job && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/jobs/${application.job.id}`}>
                          View Job
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {!isLoading && sortedApplications.length === 0 && applications.length > 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No applications found with the selected filter.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};