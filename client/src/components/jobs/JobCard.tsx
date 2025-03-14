import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { JobListing } from "@/lib/types";
import { 
  MapPin, 
  CreditCard, 
  Clock, 
  GraduationCap, 
  School, 
  Languages 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useRouter } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  job: JobListing;
}

const JobCard = ({ job }: JobCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useRouter();
  
  const getJobIcon = () => {
    const category = job.title.toLowerCase();
    if (category.includes("mathematics") || category.includes("math")) {
      return <GraduationCap className="text-xl" />;
    } else if (category.includes("primary")) {
      return <School className="text-xl" />;
    } else if (category.includes("language") || category.includes("assamese")) {
      return <Languages className="text-xl" />;
    } else {
      return <GraduationCap className="text-xl" />;
    }
  };
  
  const getJobIconColor = () => {
    const category = job.title.toLowerCase();
    if (category.includes("mathematics") || category.includes("math")) {
      return "bg-primary-100 text-primary-700";
    } else if (category.includes("primary")) {
      return "bg-secondary-100 text-secondary-700";
    } else if (category.includes("language") || category.includes("assamese")) {
      return "bg-accent-100 text-accent-700";
    } else {
      return "bg-blue-100 text-blue-700";
    }
  };
  
  const getDeadlineStatus = () => {
    const deadline = new Date(job.applicationDeadline);
    const today = new Date();
    const differenceInDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (differenceInDays <= 3) {
      return { text: `${differenceInDays} days left`, color: "text-red-500" };
    } else if (differenceInDays <= 7) {
      return { text: `${differenceInDays} days left`, color: "text-orange-500" };
    } else {
      return { text: `${differenceInDays} days left`, color: "text-gray-500" };
    }
  };
  
  const deadlineStatus = getDeadlineStatus();
  
  const handleApply = async () => {
    try {
      setIsLoading(true);
      await apiRequest("POST", "/api/applications", {
        jobId: job.id,
        status: "Applied"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      
      toast({
        title: "Application submitted",
        description: `You've successfully applied for ${job.title}`,
      });
      
      navigate("/applications");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const viewJobDetails = () => {
    navigate(`/jobs/${job.id}`);
  };
  
  return (
    <div className="p-6 border-b border-gray-100 hover:bg-gray-50 transition group">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-lg ${getJobIconColor()}`}>
            {getJobIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{job.title}</h3>
            <p className="text-gray-500 text-sm mt-1">{job.organization}</p>
            <div className="flex items-center mt-2 space-x-3 text-sm">
              <span className="flex items-center text-gray-500">
                <MapPin size={14} className="mr-1 text-gray-400" /> {job.location}
              </span>
              {job.salary && (
                <span className="flex items-center text-gray-500">
                  <CreditCard size={14} className="mr-1 text-gray-400" /> {job.salary}
                </span>
              )}
              <span className={`flex items-center ${deadlineStatus.color}`}>
                <Clock size={14} className="mr-1" /> {deadlineStatus.text}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {job.jobType && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0">
                  {job.jobType}
                </Badge>
              )}
              {job.tags && job.tags.map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className={`
                    ${index % 3 === 0 ? 'bg-green-100 text-green-700' : 
                      index % 3 === 1 ? 'bg-purple-100 text-purple-700' : 
                      'bg-yellow-100 text-yellow-700'} 
                    border-0
                  `}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <Button 
            variant="default" 
            size="sm"
            className="invisible group-hover:visible"
            onClick={handleApply}
            disabled={isLoading}
          >
            Apply Now
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="invisible group-hover:visible"
            onClick={viewJobDetails}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
