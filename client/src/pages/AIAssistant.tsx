import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, User, Send, Upload, FileUp, Lightbulb, HelpCircle, BookOpen, Briefcase } from "lucide-react";
import { ChatMessage, JobListing } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const AIAssistant = () => {
  const [message, setMessage] = useState("");
  const [uploadedResume, setUploadedResume] = useState<File | null>(null);
  const [resumeAnalysisLoading, setResumeAnalysisLoading] = useState(false);
  const [resumeAnalysis, setResumeAnalysis] = useState<{ 
    strengths: string[],
    weaknesses: string[],
    suggestions: string[]
  } | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { data: messages, isLoading: isLoadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai/chat-history"],
  });
  
  const { data: jobs, isLoading: isLoadingJobs } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
  });
  
  const sendChatMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", { message: content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim()) {
      sendChatMessage.mutate(message);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedResume(file);
  };
  
  const analyzeResume = async () => {
    if (!uploadedResume) {
      toast({
        title: "No resume uploaded",
        description: "Please upload a resume document first",
        variant: "destructive",
      });
      return;
    }
    
    setResumeAnalysisLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", uploadedResume);
      
      const response = await fetch("/api/documents/analyze-resume", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to analyze resume");
      }
      
      const analysis = await response.json();
      setResumeAnalysis(analysis);
      
      toast({
        title: "Resume analyzed",
        description: "Your resume has been analyzed successfully",
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Failed to analyze resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResumeAnalysisLoading(false);
    }
  };
  
  const generateInterviewQuestions = async () => {
    if (!selectedJob) {
      toast({
        title: "No job selected",
        description: "Please select a job to generate interview questions",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingQuestions(true);
    
    try {
      const response = await apiRequest("POST", "/api/ai/interview-questions", {
        title: selectedJob.title,
        organization: selectedJob.organization,
        description: selectedJob.description,
        requirements: selectedJob.requirements
      });
      
      const result = await response.json();
      setInterviewQuestions(result.questions || []);
      
      toast({
        title: "Questions generated",
        description: "Interview questions have been generated successfully",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Failed to generate interview questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuestions(false);
    }
  };
  
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "";
    }
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800">AI Assistant</h1>
          <p className="text-gray-500">Get help with your job search, resume, and interview preparation</p>
        </div>
        
        <Tabs defaultValue="chat">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center">
              <Bot size={16} className="mr-2" /> Chat Assistant
            </TabsTrigger>
            <TabsTrigger value="resume" className="flex items-center">
              <FileUp size={16} className="mr-2" /> Resume Analysis
            </TabsTrigger>
            <TabsTrigger value="interview" className="flex items-center">
              <Briefcase size={16} className="mr-2" /> Interview Prep
            </TabsTrigger>
          </TabsList>
          
          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Chat with AI Assistant</CardTitle>
                <CardDescription>
                  Ask questions about job searching, application tips, or career advice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 mb-4 h-[400px] overflow-y-auto">
                  {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="text-center">
                        <Bot size={40} className="mx-auto mb-4 text-primary-500 animate-pulse" />
                        <p className="text-gray-500">Loading conversation...</p>
                      </div>
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`flex ${msg.isFromUser ? 'justify-end' : ''}`}
                        >
                          {!msg.isFromUser && (
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage src="/ai-assistant.png" alt="AI" />
                              <AvatarFallback className="bg-primary-100 text-primary-700">
                                <Bot size={16} />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div 
                            className={`
                              p-3 rounded-lg max-w-[80%]
                              ${msg.isFromUser 
                                ? 'bg-primary-100 text-primary-900 rounded-tr-none' 
                                : 'bg-gray-100 text-gray-800 rounded-tl-none'}
                            `}
                          >
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatMessageTime(msg.timestamp)}
                            </p>
                          </div>
                          
                          {msg.isFromUser && (
                            <Avatar className="h-8 w-8 ml-2">
                              <AvatarImage 
                                src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80" 
                                alt="User" 
                              />
                              <AvatarFallback>
                                <User size={16} />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center">
                      <Bot size={48} className="text-primary-500 mb-4" />
                      <h3 className="font-medium text-gray-800 mb-2">Welcome to the AI Assistant</h3>
                      <p className="text-gray-500 max-w-md mb-4">
                        I'm here to help with your teaching job search in Assam. Ask me about job applications, resume tips, or interview preparation.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                        <Button
                          variant="outline"
                          className="text-left justify-start"
                          onClick={() => setMessage("What are the key skills for a mathematics teacher?")}
                        >
                          <HelpCircle size={16} className="mr-2" />
                          Skills for math teachers?
                        </Button>
                        <Button
                          variant="outline"
                          className="text-left justify-start"
                          onClick={() => setMessage("How to prepare for a teaching interview?")}
                        >
                          <Briefcase size={16} className="mr-2" />
                          Interview preparation?
                        </Button>
                        <Button
                          variant="outline"
                          className="text-left justify-start"
                          onClick={() => setMessage("What should I include in my teaching resume?")}
                        >
                          <FileUp size={16} className="mr-2" />
                          Resume advice?
                        </Button>
                        <Button
                          variant="outline"
                          className="text-left justify-start"
                          onClick={() => setMessage("What are the trending teaching methodologies?")}
                        >
                          <Lightbulb size={16} className="mr-2" />
                          Teaching trends?
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sendChatMessage.isPending}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={sendChatMessage.isPending || !message.trim()}
                  >
                    {sendChatMessage.isPending ? "Sending..." : "Send"}
                    <Send size={16} className="ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Resume Analysis Tab */}
          <TabsContent value="resume">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Resume Analysis</CardTitle>
                <CardDescription>
                  Upload your resume for AI-powered analysis and improvement suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    
                    {uploadedResume ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center">
                          <FileUp size={36} className="text-primary-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{uploadedResume.name}</p>
                          <p className="text-gray-500 text-sm">
                            {(uploadedResume.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <div className="flex justify-center space-x-2">
                          <Button 
                            variant="outline" 
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Change File
                          </Button>
                          <Button 
                            onClick={analyzeResume}
                            disabled={resumeAnalysisLoading}
                          >
                            {resumeAnalysisLoading ? "Analyzing..." : "Analyze Resume"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center">
                          <Upload size={36} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            Drag and drop your resume or click to browse
                          </p>
                          <p className="text-gray-500 text-sm">
                            Supports PDF, DOC, DOCX, and TXT (max 10MB)
                          </p>
                        </div>
                        <Button 
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select File
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {resumeAnalysis && (
                    <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                      <div>
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center">
                          <div className="bg-green-100 text-green-700 p-1 rounded-full mr-2">
                            <Lightbulb size={16} />
                          </div>
                          Resume Strengths
                        </h3>
                        <ul className="space-y-2">
                          {resumeAnalysis.strengths.map((strength, index) => (
                            <li key={index} className="text-sm flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center">
                          <div className="bg-amber-100 text-amber-700 p-1 rounded-full mr-2">
                            <HelpCircle size={16} />
                          </div>
                          Areas for Improvement
                        </h3>
                        <ul className="space-y-2">
                          {resumeAnalysis.weaknesses.map((weakness, index) => (
                            <li key={index} className="text-sm flex items-start">
                              <span className="text-amber-500 mr-2">!</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center">
                          <div className="bg-blue-100 text-blue-700 p-1 rounded-full mr-2">
                            <Lightbulb size={16} />
                          </div>
                          Suggestions
                        </h3>
                        <ul className="space-y-2">
                          {resumeAnalysis.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-sm flex items-start">
                              <span className="text-blue-500 mr-2">→</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Interview Prep Tab */}
          <TabsContent value="interview">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Interview Preparation</CardTitle>
                <CardDescription>
                  Generate personalized interview questions for specific teaching positions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Select a job to prepare for
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={selectedJob?.id || ""}
                      onChange={(e) => {
                        const jobId = parseInt(e.target.value);
                        const job = jobs?.find(j => j.id === jobId) || null;
                        setSelectedJob(job);
                      }}
                    >
                      <option value="">Select a job...</option>
                      {jobs?.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} at {job.organization}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedJob && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-800">{selectedJob.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{selectedJob.organization}</p>
                      {selectedJob.requirements && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-700">
                            <strong>Requirements:</strong> {selectedJob.requirements}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-center">
                    <Button 
                      onClick={generateInterviewQuestions}
                      disabled={!selectedJob || isLoadingQuestions}
                      className="bg-primary-500 hover:bg-primary-600 text-white"
                    >
                      {isLoadingQuestions ? "Generating Questions..." : "Generate Interview Questions"}
                    </Button>
                  </div>
                  
                  {interviewQuestions.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <h3 className="font-medium text-gray-800 flex items-center">
                        <BookOpen size={18} className="mr-2 text-primary-500" />
                        Potential Interview Questions
                      </h3>
                      
                      <div className="space-y-4">
                        {interviewQuestions.map((question, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                            <p className="text-gray-800 font-medium mb-2">
                              Question {index + 1}:
                            </p>
                            <p className="text-gray-700">{question}</p>
                            <div className="mt-3">
                              <Button variant="outline" size="sm" className="text-primary-500">
                                <Lightbulb size={14} className="mr-2" />
                                Get Answer Tips
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <Alert className="bg-primary-50 text-primary-800 border-primary-200">
                        <AlertDescription className="flex items-start">
                          <Lightbulb className="h-5 w-5 mr-2 text-primary-500 flex-shrink-0" />
                          <span>Tip: Practice answering these questions out loud or record yourself to review your responses. Focus on specific examples from your teaching experience.</span>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AIAssistant;
