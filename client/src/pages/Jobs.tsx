import React, { useState, useEffect, useMemo } from 'react';
import { useAIContextPublisher } from '@/contexts/AIPageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Calendar, Briefcase, Building, Search, ExternalLink, FileText, Zap, CheckSquare, Square, X, AlertCircle, Filter, CheckSquare2, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { BulkApplyDialog } from '@/components/jobs/BulkApplyDialog';
import { apiRequest } from '@/lib/queryClient';

export const Jobs: React.FC = () => {
  const [location] = useLocation();
  const { publishContext } = useAIContextPublisher();
  
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    category: ''
  });
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [showBulkApplyDialog, setShowBulkApplyDialog] = useState(false);
  const [showOnlySelectable, setShowOnlySelectable] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  
  const { data: jobs = [], isLoading, isError } = useQuery({
    queryKey: ['/api/jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.location) params.append('location', filters.location);
      if (filters.category) params.append('category', filters.category);
      
      const response = await fetch(`/api/jobs?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized gracefully - return empty array
          return [];
        }
        throw new Error('Failed to fetch jobs');
      }
      return response.json();
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });
  
  const { data: defaultResume } = useQuery<{
    id: number | null;
    name: string | null;
    url: string | null;
  }>({
    queryKey: ['/api/documents/default-resume'],
    enabled: isAuthenticated,
  });
  
  // Check which jobs user has already applied to
  const { data: appliedJobIds = [] } = useQuery<number[]>({
    queryKey: ['/api/applications/check-existing', jobs?.map((j: any) => j.id)],
    queryFn: async () => {
      if (!isAuthenticated || !jobs || jobs.length === 0) return [];
      const jobIds = jobs.map((j: any) => j.id);
      try {
        const response = await apiRequest('POST', '/api/applications/check-existing', { jobIds });
        if (!response.ok && response.status === 401) {
          return [];
        }
        const data = await response.json();
        return data.appliedJobIds || [];
      } catch (error) {
        console.debug('Failed to check applied jobs:', error);
        return [];
      }
    },
    enabled: isAuthenticated && !!jobs && jobs.length > 0
  });
  
  const locations = ['All Locations', 'Guwahati', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Silchar'];
  const categories = ['All Categories', 'Primary', 'Secondary', 'Higher Secondary', 'College', 'University'];
  
  // Filter jobs to show only selectable ones if needed
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    if (!showOnlySelectable) return jobs;
    return jobs.filter((job: any) => {
      const isExternal = !!job.applicationLink;
      const hasApplied = appliedJobIds.includes(job.id);
      return !isExternal && !hasApplied;
    });
  }, [jobs, showOnlySelectable, appliedJobIds]);
  
  // Publish context when jobs or filters change
  useEffect(() => {
    // Skip if loading or no data available
    if (isLoading || !jobs) return;
    
    try {
      const visibleJobs = (filteredJobs || []).slice(0, 5).map((job: any) => ({
        id: job.id,
        title: job.title || 'Untitled Job',
        organization: job.organization || 'Unknown Organization',
        location: job.location,
        category: job.category
      }));
      
      const selection = selectedJobIds.size > 0 ? {
        jobId: Array.from(selectedJobIds)[0] // First selected job ID
      } : undefined;
      
      publishContext({
        route: location,
        page: 'Jobs',
        selection,
        visibleSummary: {
          jobs: visibleJobs,
          totalJobs: (filteredJobs || []).length,
          filters: {
            query: filters.search || undefined,
            location: filters.location || undefined,
            category: filters.category || undefined
          }
        }
      });
    } catch (error) {
      console.debug('Failed to publish Jobs context:', error);
    }
  }, [location, filteredJobs, filters, selectedJobIds, publishContext, jobs, isLoading]);
  
  const applyMutation = useMutation({
    mutationFn: async ({ jobId, resumeUrl }: { jobId: number; resumeUrl?: string }) => {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, resumeUrl })
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
        description: 'Your quick application has been sent successfully with your default resume.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications/check-existing'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Application failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  const handleQuickApply = (jobId: number) => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please login to apply for jobs.',
        variant: 'destructive'
      });
      navigate('/login');
      return;
    }
    
    if (!defaultResume?.url) {
      toast({
        title: 'No default resume',
        description: 'Please upload and set a default resume first.',
        variant: 'destructive'
      });
      navigate('/documents');
      return;
    }
    
    applyMutation.mutate({ jobId, resumeUrl: defaultResume.url });
  };
  
  const handleExternalApply = async (job: any) => {
    // Track the external click
    try {
      await fetch(`/api/jobs/${job.id}/external-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to track external click:', error);
    }
    
    // Open the external link in a new tab
    window.open(job.applicationLink, '_blank', 'noopener,noreferrer');
  };
  
  
  // Get selected jobs details
  const selectedJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((job: any) => selectedJobIds.has(job.id));
  }, [jobs, selectedJobIds]);
  
  // Selectable jobs count
  const selectableJobsCount = useMemo(() => {
    if (!jobs) return 0;
    return jobs.filter((job: any) => {
      const isExternal = !!job.applicationLink;
      const hasApplied = appliedJobIds.includes(job.id);
      return !isExternal && !hasApplied;
    }).length;
  }, [jobs, appliedJobIds]);
  
  const handleJobSelect = (jobId: number, isSelectable: boolean) => {
    if (!isSelectable) {
      toast({
        title: 'Cannot select this job',
        description: 'You have already applied to this job or it requires external application.',
        variant: 'destructive'
      });
      return;
    }
    
    setSelectedJobIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = () => {
    const selectableJobs = filteredJobs.filter((job: any) => {
      const isExternal = !!job.applicationLink;
      const hasApplied = appliedJobIds.includes(job.id);
      return !isExternal && !hasApplied;
    });
    
    const allSelectableIds = new Set<number>(selectableJobs.map((job: any) => job.id));
    setSelectedJobIds(allSelectableIds);
    
    toast({
      title: 'All selectable jobs selected',
      description: `Selected ${allSelectableIds.size} job${allSelectableIds.size !== 1 ? 's' : ''}.`
    });
  };
  
  const handleDeselectAll = () => {
    setSelectedJobIds(new Set());
  };
  
  const handleBulkApplySuccess = () => {
    setSelectedJobIds(new Set());
    setShowBulkApplyDialog(false);
    queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/applications/check-existing'] });
  };
  
  const handleBulkApply = () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please login to apply for jobs.',
        variant: 'destructive'
      });
      navigate('/login');
      return;
    }
    
    if (!defaultResume?.url) {
      toast({
        title: 'No default resume',
        description: 'Please upload and set a default resume first.',
        variant: 'destructive'
      });
      navigate('/documents');
      return;
    }
    
    // Show confirmation if more than 5 jobs selected
    if (selectedJobIds.size > 5) {
      const proceed = window.confirm(`You are about to apply to ${selectedJobIds.size} jobs. Are you sure you want to continue?`);
      if (!proceed) return;
    }
    
    setShowBulkApplyDialog(true);
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teaching Jobs in Assam</h1>
        <p className="text-muted-foreground mt-2">
          Browse and apply to the latest teaching opportunities
        </p>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filter Jobs</CardTitle>
            {isAuthenticated && (
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-selectable"
                    checked={showOnlySelectable}
                    onCheckedChange={setShowOnlySelectable}
                  />
                  <Label htmlFor="show-selectable" className="text-sm">
                    Show only selectable jobs
                  </Label>
                </div>
                {selectableJobsCount > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      data-testid="button-select-all"
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Select All ({selectableJobsCount})
                    </Button>
                    {selectedJobIds.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAll}
                        data-testid="button-deselect-all"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Deselect All
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or keywords..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select
              value={filters.location}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                location: value === 'All Locations' ? '' : value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                category: value === 'All Categories' ? '' : value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Job count and selection info */}
      {!isLoading && isAuthenticated && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} 
            {showOnlySelectable && ` (${selectableJobsCount} selectable)`}
          </span>
          {selectedJobIds.size > 0 && (
            <span className="font-medium text-primary">
              {selectedJobIds.size} job{selectedJobIds.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      )}
      
      {/* Job Listings */}
      <div className="space-y-4 pb-20">
        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading jobs...
            </CardContent>
          </Card>
        )}
        
        {!isLoading && filteredJobs.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {showOnlySelectable 
                ? 'No selectable jobs found. Try turning off the filter.'
                : 'No jobs found matching your criteria'
              }
            </CardContent>
          </Card>
        )}
        
        {filteredJobs.map((job: any) => {
          const isExternal = !!job.applicationLink;
          const hasApplied = appliedJobIds.includes(job.id);
          const isSelectable = !isExternal && !hasApplied && isAuthenticated;
          const isSelected = selectedJobIds.has(job.id);
          
          return (
          <Card 
            key={job.id} 
            className={`hover:shadow-lg transition-all duration-200 ${
              isSelected ? 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10' : ''
            } ${
              !isSelectable && isAuthenticated ? 'opacity-75' : ''
            }`}
            data-testid={`job-card-${job.id}`}
          >
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Checkbox for selection */}
                {isAuthenticated && (
                  <div className="flex items-start">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleJobSelect(job.id, isSelectable)}
                              disabled={!isSelectable}
                              data-testid={`checkbox-job-${job.id}`}
                              className={`mt-1 ${
                                !isSelectable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              }`}
                            />
                          </div>
                        </TooltipTrigger>
                        {!isSelectable && (
                          <TooltipContent>
                            {hasApplied ? 'You have already applied to this job' : 
                             isExternal ? 'Cannot bulk apply to external jobs' : 
                             'Sign in to select jobs'}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{job.title}</h3>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {job.organization}
                  </p>
                  
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {job.jobType || 'Full-time'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Posted {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="mt-3 text-sm line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    {job.category && (
                      <Badge variant="secondary">{job.category}</Badge>
                    )}
                    {job.salary && (
                      <Badge variant="outline">{job.salary}</Badge>
                    )}
                    {job.applicationLink && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        External Application
                      </Badge>
                    )}
                    {hasApplied && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Already Applied
                      </Badge>
                    )}
                    {job.applicationDeadline && (
                      <Badge variant="outline">
                        Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {job.applicationLink ? (
                    <Button 
                      onClick={() => handleExternalApply(job)}
                      className="flex items-center gap-2"
                      data-testid={`button-external-apply-${job.id}`}
                    >
                      Apply Externally
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ) : !hasApplied ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={() => handleQuickApply(job.id)}
                            disabled={applyMutation.isPending}
                            data-testid={`button-apply-${job.id}`}
                            className="flex items-center gap-2"
                          >
                            <Zap className="h-4 w-4" />
                            {applyMutation.isPending ? 'Applying...' : 'Quick Apply'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {defaultResume?.name ? (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>Apply with: {defaultResume.name}</span>
                            </div>
                          ) : (
                            <span>Upload and set a default resume first</span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button variant="secondary" disabled>
                      Applied
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    data-testid={`button-view-${job.id}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
      
      {/* Bulk Apply Dialog */}
      {showBulkApplyDialog && (
        <BulkApplyDialog
          open={showBulkApplyDialog}
          onOpenChange={setShowBulkApplyDialog}
          selectedJobs={selectedJobs}
          onSuccess={handleBulkApplySuccess}
        />
      )}
      
      {/* Sticky Bottom Bar for Bulk Actions */}
      {isAuthenticated && selectedJobIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50">
          <div className="container mx-auto p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare2 className="h-5 w-5 text-primary" />
                  <span className="font-medium text-lg">
                    {selectedJobIds.size} job{selectedJobIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                {selectedJobIds.size === selectableJobsCount && selectableJobsCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    All eligible jobs selected
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {selectedJobIds.size > 5 && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      Applying to many jobs
                    </span>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleDeselectAll}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
                
                <Button
                  size="default"
                  onClick={handleBulkApply}
                  disabled={selectedJobIds.size === 0}
                  className="shadow-md bg-primary hover:bg-primary/90"
                  data-testid="button-bulk-apply"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Apply to {selectedJobIds.size} Job{selectedJobIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};