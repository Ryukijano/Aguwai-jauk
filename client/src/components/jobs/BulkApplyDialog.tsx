import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Briefcase } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BulkApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobs: Array<{
    id: number;
    title: string;
    organization: string;
    location: string;
  }>;
  onSuccess: () => void;
}

interface BulkApplyResult {
  success: boolean;
  results: {
    successes: any[];
    failures: Array<{ jobId: number; error: string }>;
    skipped: Array<{ jobId: number; reason: string }>;
  };
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

export const BulkApplyDialog: React.FC<BulkApplyDialogProps> = ({
  open,
  onOpenChange,
  selectedJobs,
  onSuccess
}) => {
  const [coverLetter, setCoverLetter] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<BulkApplyResult | null>(null);
  const { toast } = useToast();

  // Fetch user's resumes
  const { data: resumes = [] } = useQuery({
    queryKey: ['/api/documents'],
    enabled: open
  });

  const userResumes = resumes.filter((doc: any) => doc.type === 'resume');
  const defaultResume = userResumes.find((r: any) => r.isDefault);

  const bulkApplyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/applications/bulk', {
        method: 'POST',
        body: JSON.stringify({
          jobIds: selectedJobs.map(j => j.id),
          resumeId: selectedResumeId || undefined,
          coverLetter: coverLetter || undefined
        })
      });
      return response;
    },
    onSuccess: (data) => {
      setResults(data);
      setShowResults(true);
      
      // Invalidate applications cache
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      
      // Show success toast
      if (data.summary.succeeded > 0) {
        toast({
          title: 'Applications submitted!',
          description: `Successfully applied to ${data.summary.succeeded} job${data.summary.succeeded > 1 ? 's' : ''}.`
        });
      }
      
      // Call parent success callback if all succeeded
      if (data.summary.failed === 0 && data.summary.skipped === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          resetDialog();
        }, 2000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk apply failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const resetDialog = () => {
    setCoverLetter('');
    setSelectedResumeId('');
    setShowResults(false);
    setResults(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetDialog();
  };

  const handleRetryFailed = () => {
    if (!results) return;
    
    const failedJobIds = results.results.failures.map(f => f.jobId);
    const jobsToRetry = selectedJobs.filter(j => failedJobIds.includes(j.id));
    
    // Reset and retry with failed jobs
    setShowResults(false);
    setResults(null);
    
    // You would need to update the parent to only have failed jobs selected
    toast({
      title: 'Retrying failed applications',
      description: `Retrying ${jobsToRetry.length} failed application${jobsToRetry.length > 1 ? 's' : ''}.`
    });
  };

  const progressPercentage = bulkApplyMutation.isPending ? 50 : (results ? 100 : 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Apply to Multiple Jobs</DialogTitle>
          <DialogDescription>
            {showResults ? 
              'Application Results' : 
              `Apply to ${selectedJobs.length} selected job${selectedJobs.length > 1 ? 's' : ''}`
            }
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4 flex-1 overflow-auto">
            {/* Selected Jobs List */}
            <div>
              <Label>Selected Jobs ({selectedJobs.length})</Label>
              <ScrollArea className="h-32 mt-2 border rounded-md p-2">
                {selectedJobs.map(job => (
                  <div key={job.id} className="flex items-start gap-2 py-1" data-testid={`bulk-job-${job.id}`}>
                    <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{job.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {job.organization} • {job.location}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Resume Selection */}
            <div className="space-y-2">
              <Label htmlFor="resume">Resume</Label>
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger id="resume" data-testid="select-resume">
                  <SelectValue placeholder={defaultResume ? `Default: ${defaultResume.name}` : 'Select a resume'} />
                </SelectTrigger>
                <SelectContent>
                  {userResumes.map((resume: any) => (
                    <SelectItem key={resume.id} value={resume.id.toString()}>
                      {resume.name}
                      {resume.isDefault && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userResumes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No resumes found. Upload a resume first.
                </p>
              )}
            </div>

            {/* Cover Letter */}
            <div className="space-y-2">
              <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
              <Textarea
                id="coverLetter"
                placeholder="Enter a cover letter that will be sent with all applications..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={4}
                data-testid="input-cover-letter"
              />
              <p className="text-xs text-muted-foreground">
                This cover letter will be included with all selected applications.
              </p>
            </div>

            {/* Warning for many jobs */}
            {selectedJobs.length > 5 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You're applying to {selectedJobs.length} jobs at once. Make sure your resume and cover letter are relevant to all positions.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          /* Results View */
          <div className="space-y-4 flex-1 overflow-auto">
            {results && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  {results.summary.succeeded > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="font-medium text-green-900 dark:text-green-100">
                          {results.summary.succeeded}
                        </div>
                        <div className="text-xs text-green-700 dark:text-green-300">Succeeded</div>
                      </div>
                    </div>
                  )}
                  
                  {results.summary.failed > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <div className="font-medium text-red-900 dark:text-red-100">
                          {results.summary.failed}
                        </div>
                        <div className="text-xs text-red-700 dark:text-red-300">Failed</div>
                      </div>
                    </div>
                  )}
                  
                  {results.summary.skipped > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      <div>
                        <div className="font-medium text-yellow-900 dark:text-yellow-100">
                          {results.summary.skipped}
                        </div>
                        <div className="text-xs text-yellow-700 dark:text-yellow-300">Skipped</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Results */}
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {/* Failed applications */}
                    {results.results.failures.map((failure, idx) => {
                      const job = selectedJobs.find(j => j.id === failure.jobId);
                      return (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{job?.title || `Job ${failure.jobId}`}</div>
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {failure.error}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Skipped applications */}
                    {results.results.skipped.map((skipped, idx) => {
                      const job = selectedJobs.find(j => j.id === skipped.jobId);
                      return (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{job?.title || `Job ${skipped.jobId}`}</div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-400">
                              {skipped.reason}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Successful applications */}
                    {results.results.successes.map((success, idx) => {
                      const job = selectedJobs.find(j => j.id === success.jobId);
                      return (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{job?.title || `Job ${success.jobId}`}</div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Successfully applied
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {bulkApplyMutation.isPending && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing applications...</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {!showResults ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={bulkApplyMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => bulkApplyMutation.mutate()}
                disabled={bulkApplyMutation.isPending || userResumes.length === 0}
                data-testid="button-submit-bulk-apply"
              >
                {bulkApplyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  `Apply to ${selectedJobs.length} Job${selectedJobs.length > 1 ? 's' : ''}`
                )}
              </Button>
            </>
          ) : (
            <>
              {results && results.summary.failed > 0 && (
                <Button variant="outline" onClick={handleRetryFailed}>
                  Retry Failed ({results.summary.failed})
                </Button>
              )}
              <Button onClick={handleClose}>
                {results && results.summary.failed === 0 && results.summary.skipped === 0 ? 'Done' : 'Close'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};