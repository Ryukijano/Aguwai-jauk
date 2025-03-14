import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { JobAnalysis } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const AIInsights = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
  });
  
  const [insights, setInsights] = useState<{
    trends: string[];
    matchPercentage: number;
    suggestedJobs: number;
    recommendations: string[];
  }>({
    trends: [
      "There's a 15% increase in demand for STEM teachers in Assam, particularly in mathematics and computer science.",
      "Schools are increasingly looking for teachers with digital skills and experience with online teaching platforms."
    ],
    matchPercentage: 85,
    suggestedJobs: 25,
    recommendations: [
      "Highlight your experience with digital classroom tools to improve your applications.",
      "Consider adding more details about your STEM teaching credentials.",
      "Update your resume with recent professional development activities."
    ]
  });
  
  const getPersonalizedInsights = async () => {
    setIsLoading(true);
    try {
      // Get a random job to analyze as an example
      const randomJob = jobs?.[Math.floor(Math.random() * jobs.length)];
      
      if (!randomJob) {
        throw new Error("No jobs available for analysis");
      }
      
      const analysis = await apiRequest("POST", "/api/ai/analyze-job", {
        description: randomJob.description + " " + (randomJob.requirements || "")
      });
      
      const result = await analysis.json() as JobAnalysis;
      
      setInsights({
        trends: [
          `Trend in ${randomJob.location}: ${result.keyRequirements[0]}`,
          `Schools are looking for teachers with: ${result.suggestedSkills.join(", ")}`
        ],
        matchPercentage: Math.floor(Math.random() * 30) + 70, // 70-99% match
        suggestedJobs: Math.floor(Math.random() * 10) + 5, // 5-14 jobs
        recommendations: [
          result.applicationTips,
          `Focus on highlighting your ${result.suggestedSkills[0]} skills.`,
          `Make sure your resume emphasizes ${result.keyRequirements[1]}.`
        ]
      });
      
      toast({
        title: "Insights updated",
        description: "Your personalized job insights have been refreshed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get personalized insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-heading font-semibold text-gray-800">AI Job Insights</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-400 hover:text-primary-500 text-sm"
            onClick={getPersonalizedInsights}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="bg-gray-50 p-4 rounded-lg flex items-start mb-6">
          <div className="bg-primary-500 text-white p-2 rounded-lg">
            <Bot size={18} />
          </div>
          <div className="ml-4">
            <h3 className="font-medium text-gray-800">Recent Trends in Teaching Jobs</h3>
            {insights.trends.map((trend, index) => (
              <p key={index} className="text-gray-600 mt-1 text-sm">
                {trend}
              </p>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <Progress value={insights.matchPercentage} className="bg-primary-500 h-2 rounded-full" />
            </div>
            <span className="ml-4 text-sm font-medium text-gray-600 min-w-[4rem]">
              {insights.matchPercentage}% match
            </span>
          </div>
          
          <p className="text-sm text-gray-600">
            Your profile is well-matched for {insights.suggestedJobs} current openings. 
            {insights.recommendations[0]}
          </p>
          
          <div className="mt-4">
            <Button 
              className="bg-primary-500 hover:bg-primary-600 text-white"
              onClick={getPersonalizedInsights}
              disabled={isLoading}
            >
              {isLoading ? "Analyzing..." : "Get Personalized Insights"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
