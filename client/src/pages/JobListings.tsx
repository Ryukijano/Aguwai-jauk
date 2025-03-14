import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "wouter";
import MainLayout from "@/components/layout/MainLayout";
import JobCard from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Search, FilterX, Filter, RefreshCw } from "lucide-react";
import { JobListing } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const JobListings = () => {
  const [currentPath] = useLocation();
  const [, navigate] = useRouter();
  const { toast } = useToast();
  const [isScrapingJobs, setIsScrapingJobs] = useState(false);
  
  // Get query params
  const params = new URLSearchParams(currentPath.split("?")[1] || "");
  const searchQuery = params.get("search") || "";
  
  // Filter states
  const [search, setSearch] = useState(searchQuery);
  const [category, setCategory] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");
  const [jobType, setJobType] = useState<string>("all");
  
  // Fetch job listings
  const { data: jobs, isLoading, error } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
  });
  
  // Apply filters to jobs
  const filteredJobs = jobs?.filter(job => {
    // Search filter
    const matchesSearch = 
      search === "" || 
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.organization.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    
    // Category filter
    const matchesCategory = 
      category === "all" || 
      job.category?.toLowerCase() === category.toLowerCase();
    
    // Location filter
    const matchesLocation = 
      location === "all" || 
      job.location.toLowerCase().includes(location.toLowerCase());
    
    // Job type filter
    const matchesJobType = 
      jobType === "all" || 
      job.jobType?.toLowerCase() === jobType.toLowerCase();
    
    return matchesSearch && matchesCategory && matchesLocation && matchesJobType;
  });
  
  // Scrape new jobs
  const handleJobScraping = async () => {
    try {
      setIsScrapingJobs(true);
      const response = await apiRequest("POST", "/api/jobs/scrape", undefined);
      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      toast({
        title: "Jobs scraped successfully",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scrape jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScrapingJobs(false);
    }
  };
  
  // Reset filters
  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setLocation("all");
    setJobType("all");
    
    // Update URL
    navigate("/jobs");
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update URL with search query
    if (search) {
      navigate(`/jobs?search=${encodeURIComponent(search)}`);
    } else {
      navigate("/jobs");
    }
  };
  
  // Get unique locations and job types for filters
  const uniqueLocations = jobs ? Array.from(new Set(jobs.map(job => job.location))) : [];
  const uniqueJobTypes = jobs ? Array.from(new Set(jobs.filter(job => job.jobType).map(job => job.jobType as string))) : [];
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-800">Job Listings</h1>
            <p className="text-gray-500">Find and apply for teaching positions across Assam</p>
          </div>
          
          <Button 
            onClick={handleJobScraping}
            disabled={isScrapingJobs}
            className="bg-primary-500 hover:bg-primary-600 text-white"
          >
            <RefreshCw size={16} className={`mr-2 ${isScrapingJobs ? "animate-spin" : ""}`} />
            {isScrapingJobs ? "Scraping..." : "Scrape New Jobs"}
          </Button>
        </div>
        
        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center">
              <Filter size={18} className="mr-2" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <Input
                      placeholder="Search jobs..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </form>
              </div>
              
              <div>
                <Select 
                  value={category} 
                  onValueChange={setCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="Private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Select 
                  value={location} 
                  onValueChange={setLocation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {uniqueLocations.map(loc => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Select 
                  value={jobType} 
                  onValueChange={setJobType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Job Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueJobTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-3">
                <div className="flex flex-wrap gap-2">
                  {search && (
                    <Badge variant="secondary" className="px-3 py-1">
                      Search: {search}
                      <button className="ml-2" onClick={() => setSearch("")}>×</button>
                    </Badge>
                  )}
                  {category !== "all" && (
                    <Badge variant="secondary" className="px-3 py-1">
                      Category: {category}
                      <button className="ml-2" onClick={() => setCategory("all")}>×</button>
                    </Badge>
                  )}
                  {location !== "all" && (
                    <Badge variant="secondary" className="px-3 py-1">
                      Location: {location}
                      <button className="ml-2" onClick={() => setLocation("all")}>×</button>
                    </Badge>
                  )}
                  {jobType !== "all" && (
                    <Badge variant="secondary" className="px-3 py-1">
                      Job Type: {jobType}
                      <button className="ml-2" onClick={() => setJobType("all")}>×</button>
                    </Badge>
                  )}
                </div>
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={resetFilters}
                >
                  <FilterX size={16} className="mr-2" /> Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Job Listings */}
        <Card>
          <CardHeader className="pb-0 pt-6">
            <CardTitle className="text-lg">
              {filteredJobs?.length || 0} Jobs Found
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="text-center py-8">
                <Briefcase className="inline-block animate-pulse text-primary-500 mb-4" size={40} />
                <p>Loading job listings...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p>Error loading jobs. Please try again.</p>
              </div>
            ) : filteredJobs && filteredJobs.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredJobs.map(job => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Briefcase className="inline-block mb-4" size={40} />
                <p className="mb-2">No job listings found matching your criteria.</p>
                <Button variant="link" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default JobListings;
