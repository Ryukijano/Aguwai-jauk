import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, Briefcase, Building, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export const Jobs: React.FC = () => {
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    category: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.location) params.append('location', filters.location);
      if (filters.category) params.append('category', filters.category);
      
      const response = await fetch(`/api/jobs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    }
  });
  
  const applyMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
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
        description: 'Your application has been sent successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Application failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  const locations = ['All Locations', 'Guwahati', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Silchar'];
  const categories = ['All Categories', 'Primary', 'Secondary', 'Higher Secondary', 'College', 'University'];
  
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
          <CardTitle>Filter Jobs</CardTitle>
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
      
      {/* Job Listings */}
      <div className="space-y-4">
        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading jobs...
            </CardContent>
          </Card>
        )}
        
        {!isLoading && jobs.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No jobs found matching your criteria
            </CardContent>
          </Card>
        )}
        
        {jobs.map((job: any) => (
          <Card key={job.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
                    {job.applicationDeadline && (
                      <Badge variant="outline">
                        Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => applyMutation.mutate(job.id)}
                    disabled={applyMutation.isPending}
                  >
                    {applyMutation.isPending ? 'Applying...' : 'Apply Now'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};