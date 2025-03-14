import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import JobCard from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobListing } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FilterBadgeProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const FilterBadge = ({ label, isActive, onClick }: FilterBadgeProps) => {
  return (
    <Badge 
      variant={isActive ? "default" : "outline"}
      className={`
        cursor-pointer
        ${isActive 
          ? "bg-primary-500 text-white hover:bg-primary-600" 
          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"}
      `}
      onClick={onClick}
    >
      {label}
    </Badge>
  );
};

const JobListingSkeleton = () => (
  <div className="p-6 border-b border-gray-100">
    <div className="flex items-start space-x-4">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-full max-w-[250px]" />
        <Skeleton className="h-4 w-full max-w-[200px]" />
        <div className="flex items-center mt-2 space-x-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

interface JobListingsSectionProps {
  limit?: number;
  showFilters?: boolean;
  showViewAll?: boolean;
  title?: string;
}

const JobListingsSection = ({ 
  limit = 3, 
  showFilters = true,
  showViewAll = true,
  title = "Recent Job Listings"
}: JobListingsSectionProps) => {
  const [activeFilter, setActiveFilter] = useState<string>("All Jobs");
  const [displayCount, setDisplayCount] = useState(limit);
  
  const { data: jobs, isLoading } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
  });
  
  const filters = [
    "All Jobs", 
    "Government", 
    "Private", 
    "Primary", 
    "Secondary"
  ];
  
  const filteredJobs = jobs?.filter(job => {
    if (activeFilter === "All Jobs") return true;
    if (activeFilter === "Government" || activeFilter === "Private") {
      return job.category === activeFilter;
    }
    if (activeFilter === "Primary" || activeFilter === "Secondary") {
      return job.tags?.includes(activeFilter);
    }
    return true;
  });
  
  const displayJobs = filteredJobs?.slice(0, displayCount);
  
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 3);
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-heading font-semibold text-gray-800">{title}</h2>
          {showViewAll && (
            <Link href="/jobs">
              <a className="text-primary-500 hover:text-primary-600 text-sm font-medium">
                View All
              </a>
            </Link>
          )}
        </div>
      </div>
      
      {showFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
          {filters.map(filter => (
            <FilterBadge
              key={filter}
              label={filter}
              isActive={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            />
          ))}
        </div>
      )}
      
      {isLoading ? (
        <>
          <JobListingSkeleton />
          <JobListingSkeleton />
          <JobListingSkeleton />
        </>
      ) : displayJobs && displayJobs.length > 0 ? (
        <>
          {displayJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
          
          {filteredJobs && displayCount < filteredJobs.length && (
            <div className="p-4 flex justify-center">
              <Button 
                variant="link" 
                className="text-primary-500 hover:text-primary-600 font-medium text-sm"
                onClick={handleLoadMore}
              >
                Load More <ChevronDown className="ml-1" size={16} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="p-6 text-center text-gray-500">
          No job listings found matching your criteria.
        </div>
      )}
    </div>
  );
};

export default JobListingsSection;
