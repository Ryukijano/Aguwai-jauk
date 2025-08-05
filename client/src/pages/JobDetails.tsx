import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar, Briefcase, Building, Clock, ChevronLeft, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { JobListing } from '@shared/schema';

export const JobDetails: React.FC = () => {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const { data: job, isLoading } = useQuery<JobListing>({
    queryKey: [`/api/jobs/${id}`],
    enabled: !!id,
  });

  const { data: existingApplication } = useQuery<{ hasApplied: boolean }>({
    queryKey: [`/api/applications/check/${id}`],
    enabled: !!id && isAuthenticated,
  });

  const applyMutation = useMutation({
    mutationFn: async (data: { jobId: number; coverLetter: string }) => {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Application submitted!',
        description: 'Your application has been sent successfully.',
      });
      setShowApplyDialog(false);
      setCoverLetter('');
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: [`/api/applications/check/${id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Application failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApply = () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please login to apply for this job.',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }
    setShowApplyDialog(true);
  };

  const submitApplication = () => {
    if (!job) return;
    applyMutation.mutate({ jobId: job.id, coverLetter });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Job not found</h2>
        <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const hasApplied = existingApplication?.hasApplied;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/jobs')}
        className="mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Jobs
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{job.title}</CardTitle>
              <CardDescription className="text-lg">{job.organization}</CardDescription>
            </div>
            <Badge variant={job.category === 'Government' ? 'default' : 'secondary'}>
              {job.category}
            </Badge>
          </div>
          
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location}
            </div>
            {job.jobType && (
              <div className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {job.jobType}
              </div>
            )}
            {job.salary && (
              <div className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                {job.salary}
              </div>
            )}
            {job.applicationDeadline && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Deadline: {formatDate(job.applicationDeadline)}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* AI Summary */}
          {job.aiSummary && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-primary">✨</span> AI Summary
              </h3>
              <p className="text-sm">{job.aiSummary}</p>
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Job Description</h3>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Requirements</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{job.requirements}</p>
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {job.tags && job.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Skills & Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Source */}
          {job.source && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Source: {job.source}</p>
                  <p className="text-xs text-muted-foreground">
                    Posted on {formatDate(job.createdAt)}
                  </p>
                </div>
                {job.sourceUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(job.sourceUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Original Posting
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Apply Button */}
          <div className="pt-4">
            {hasApplied ? (
              <div className="flex items-center gap-2 text-green-600">
                <Clock className="h-5 w-5" />
                <span className="font-medium">You have already applied for this position</span>
              </div>
            ) : (
              <Button 
                size="lg" 
                className="w-full md:w-auto"
                onClick={handleApply}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? 'Submitting...' : 'Apply for this Position'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application for this position at {job.organization}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
              <Textarea
                id="coverLetter"
                placeholder="Write a brief cover letter explaining why you're interested in this position..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Your profile information and resume will be included with your application.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitApplication} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};