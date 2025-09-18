import React, { useEffect } from 'react';
import { useAIContextPublisher } from '@/contexts/AIPageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Building, 
  MapPin, 
  Calendar, 
  Clock, 
  FileText,
  Briefcase,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { format } from 'date-fns';
import { StatusBadge, getStatusDescription, ApplicationStatus } from '@/components/StatusBadge';
import { ApplicationTimeline } from '@/components/ApplicationTimeline';
import type { Application, JobListing, ApplicationStatusHistory } from '@shared/schema';

export const ApplicationDetails: React.FC = () => {
  const [, params] = useRoute('/applications/:id');
  const applicationId = params?.id;
  const { publishContext } = useAIContextPublisher();
  
  const { data: application, isLoading: loadingApplication } = useQuery<Application>({
    queryKey: [`/api/applications/${applicationId}`],
    enabled: !!applicationId,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });
  
  const { data: history = [], isLoading: loadingHistory } = useQuery<ApplicationStatusHistory[]>({
    queryKey: [`/api/applications/${applicationId}/history`],
    enabled: !!applicationId,
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
  
  // Publish context when application data changes
  useEffect(() => {
    // Skip if still loading or no data
    if (loadingApplication || loadingHistory || jobsLoading || !application) return;
    
    try {
      const job = jobListings?.find((j) => j?.id === application?.jobId);
      
      publishContext({
        route: window.location.pathname,
        page: 'ApplicationDetails',
        params: { applicationId: applicationId || '' },
        selection: { applicationId: application?.id },
        visibleSummary: {
          applications: [{
            id: application?.id || 0,
            jobTitle: job?.title || `Application #${application?.id || 'N/A'}`,
            status: application?.status || 'Pending'
          }],
          job: job ? {
            id: job.id,
            title: job.title || 'Untitled Job',
            organization: job.organization || 'Unknown Organization',
            location: job.location || undefined,
            category: job.category || undefined
          } : undefined
        }
      });
    } catch (error) {
      console.debug('Failed to publish ApplicationDetails context:', error);
    }
  }, [application, applicationId, jobListings, publishContext, loadingApplication, loadingHistory, jobsLoading]);
  
  if (loadingApplication || loadingHistory) {
    return <LoadingSkeleton />;
  }
  
  if (!application) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">Application Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This application could not be found or you don't have permission to view it.
            </p>
            <Button asChild>
              <Link href="/applications">Back to Applications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const job = jobListings?.find((j) => j?.id === application?.jobId);
  const normalizedStatus = ((application?.status || 'pending').toLowerCase().replace(' ', '_')) as ApplicationStatus;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/applications" data-testid="back-button">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Application Details</h1>
            <p className="text-muted-foreground">
              Track your application progress
            </p>
          </div>
        </div>
        <StatusBadge status={normalizedStatus} showIcon={true} className="scale-110" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Information */}
          {job && (
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
                <CardDescription>Details about the position you applied for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {job.organization}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                    {job.jobType && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.jobType}
                      </span>
                    )}
                    {job.salary && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {job.salary}
                      </span>
                    )}
                  </div>
                </div>
                
                {job.description && (
                  <div>
                    <h4 className="font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {job.description}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/jobs/${job.id}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Full Job Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Application Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
              <CardDescription>
                Track your application's progress through each stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <ApplicationTimeline 
                  history={history} 
                  currentStatus={normalizedStatus}
                  orientation="vertical"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No status history available yet</p>
                  <p className="text-sm mt-2">Status updates will appear here as your application progresses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Application Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Application ID</p>
                <p className="font-medium">#{application.id}</p>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                <StatusBadge status={normalizedStatus} showIcon={false} />
                <p className="text-xs text-muted-foreground mt-1">
                  {getStatusDescription(normalizedStatus)}
                </p>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Applied Date</p>
                <p className="font-medium">
                  {application.appliedAt ? format(new Date(application.appliedAt), 'MMMM d, yyyy') : 'N/A'}
                </p>
                {application.appliedAt && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(application.appliedAt), 'h:mm a')}
                  </p>
                )}
              </div>
              
              {application.updatedAt && application.appliedAt && application.updatedAt !== application.appliedAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                    <p className="font-medium">
                      {format(new Date(application.updatedAt), 'MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(application.updatedAt), 'h:mm a')}
                    </p>
                  </div>
                </>
              )}
              
              {application.interviewDate && (
                <>
                  <Separator />
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      Interview Scheduled
                    </p>
                    <p className="text-sm">
                      {application.interviewDate ? format(new Date(application.interviewDate), 'MMMM d, yyyy') : 'TBD'}
                    </p>
                    {application.interviewDate && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {format(new Date(application.interviewDate), 'h:mm a')}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Documents */}
          {(application.resumeUrl || application.coverLetter) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submitted Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {application.resumeUrl && (
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                )}
                {application.coverLetter && (
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Cover Letter
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Notes */}
          {application.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {application.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10" />
        <div>
          <Skeleton className="w-48 h-8 mb-2" />
          <Skeleton className="w-64 h-4" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="w-32 h-6 mb-2" />
              <Skeleton className="w-48 h-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full h-20" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Skeleton className="w-40 h-6 mb-2" />
              <Skeleton className="w-56 h-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full h-64" />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="w-36 h-5" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full h-40" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}