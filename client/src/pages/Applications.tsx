import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileEdit,
  Trash2,
  FileText,
  CalendarRange,
  Plus,
  ExternalLink,
  Building,
  MapPin,
  Clock,
} from "lucide-react";
import { Application, JobListing } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  "Applied": "bg-blue-100 text-blue-700",
  "Interview Scheduled": "bg-purple-100 text-purple-700",
  "Rejected": "bg-red-100 text-red-700",
  "Offer Received": "bg-green-100 text-green-700",
  "Offer Accepted": "bg-green-100 text-green-700",
  "Offer Declined": "bg-amber-100 text-amber-700",
  "Withdrawn": "bg-gray-100 text-gray-700",
};

interface ApplicationWithJob extends Application {
  job?: JobListing;
}

const Applications = () => {
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithJob | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form states for editing
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [interviewDate, setInterviewDate] = useState("");

  const { data: applications, isLoading: isLoadingApplications } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: jobs, isLoading: isLoadingJobs } = useQuery<JobListing[]>({
    queryKey: ["/api/jobs"],
  });

  // Combine applications with their job details
  const applicationsWithJobs: ApplicationWithJob[] = applications
    ? applications.map(app => ({
        ...app,
        job: jobs?.find(job => job.id === app.jobId),
      }))
    : [];

  // Update application mutation
  const updateApplication = useMutation({
    mutationFn: async (application: Partial<Application>) => {
      await apiRequest("PATCH", `/api/applications/${application.id}`, application);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Application updated",
        description: "Your application has been updated successfully",
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (application: ApplicationWithJob) => {
    setSelectedApplication(application);
    setStatus(application.status);
    setNotes(application.notes || "");
    setInterviewDate(application.interviewDate 
      ? format(new Date(application.interviewDate), "yyyy-MM-dd'T'HH:mm")
      : "");
    setIsEditDialogOpen(true);
  };

  const handleViewClick = (application: ApplicationWithJob) => {
    setSelectedApplication(application);
    setIsViewDialogOpen(true);
  };

  const handleDeleteClick = (application: ApplicationWithJob) => {
    setSelectedApplication(application);
    setIsDeleteDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedApplication) return;
    
    const updates: Partial<Application> = {
      id: selectedApplication.id,
      status,
      notes,
    };
    
    if (interviewDate) {
      updates.interviewDate = new Date(interviewDate).toISOString();
    }
    
    updateApplication.mutate(updates);
  };

  const handleDeleteConfirm = () => {
    // In a real app, would call an API to delete the application
    toast({
      title: "Not implemented",
      description: "Application deletion is not implemented in this demo",
    });
    setIsDeleteDialogOpen(false);
  };

  const isLoading = isLoadingApplications || isLoadingJobs;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-800">My Applications</h1>
            <p className="text-gray-500">Track and manage your job applications</p>
          </div>
          
          <Button className="bg-primary-500 hover:bg-primary-600 text-white">
            <Plus size={16} className="mr-2" /> New Application
          </Button>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Applications</CardTitle>
            <CardDescription>
              You have {applications?.length || 0} applications in progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <FileText className="inline-block animate-pulse text-primary-500 mb-4" size={40} />
                <p>Loading applications...</p>
              </div>
            ) : applicationsWithJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="inline-block mb-4" size={40} />
                <p className="mb-2">You haven't applied to any jobs yet.</p>
                <Button variant="link" onClick={() => window.location.href = "/jobs"}>
                  Browse job listings
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied On</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicationsWithJobs.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="font-medium">
                        {application.job?.title || "Unknown Job"}
                      </TableCell>
                      <TableCell>
                        {application.job?.organization || "Unknown Organization"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[application.status] || "bg-gray-100 text-gray-700"}
                        >
                          {application.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(application.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewClick(application)}
                          >
                            <FileText size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(application)}
                          >
                            <FileEdit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(application)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Application Dialog */}
      {selectedApplication && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {selectedApplication.job?.title || "Unknown Position"}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start">
                    <Building size={16} className="text-gray-400 mt-0.5 mr-2" />
                    <span>{selectedApplication.job?.organization || "Unknown Organization"}</span>
                  </div>
                  
                  <div className="flex items-start">
                    <MapPin size={16} className="text-gray-400 mt-0.5 mr-2" />
                    <span>{selectedApplication.job?.location || "Unknown Location"}</span>
                  </div>
                  
                  {selectedApplication.job?.applicationDeadline && (
                    <div className="flex items-start">
                      <Clock size={16} className="text-gray-400 mt-0.5 mr-2" />
                      <span>Deadline: {format(new Date(selectedApplication.job.applicationDeadline), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  
                  {selectedApplication.job?.salary && (
                    <div className="flex items-start">
                      <span className="text-gray-400 mt-0.5 mr-2">₹</span>
                      <span>{selectedApplication.job.salary}</span>
                    </div>
                  )}
                </div>
                
                {selectedApplication.job?.description && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Job Description</h4>
                    <p className="text-sm text-gray-600">{selectedApplication.job.description}</p>
                  </div>
                )}
                
                {selectedApplication.job?.sourceUrl && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedApplication.job.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} className="mr-2" /> View Original Posting
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Application Status</h4>
                    <Badge
                      variant="outline"
                      className={`${statusColors[selectedApplication.status] || "bg-gray-100 text-gray-700"} text-sm px-3 py-1`}
                    >
                      {selectedApplication.status}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Applied On</h4>
                    <p className="text-gray-900">
                      {format(new Date(selectedApplication.createdAt), "MMMM d, yyyy")}
                    </p>
                  </div>
                  
                  {selectedApplication.interviewDate && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Interview Date</h4>
                      <p className="text-gray-900">
                        {format(new Date(selectedApplication.interviewDate), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {selectedApplication.resumeUrl && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Resume</h4>
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedApplication.resumeUrl} target="_blank" rel="noopener noreferrer">
                          <FileText size={14} className="mr-2" /> View Resume
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  {selectedApplication.coverLetterUrl && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Cover Letter</h4>
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedApplication.coverLetterUrl} target="_blank" rel="noopener noreferrer">
                          <FileText size={14} className="mr-2" /> View Cover Letter
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  {selectedApplication.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Notes</h4>
                      <p className="text-gray-600 text-sm p-3 bg-gray-50 rounded-md">{selectedApplication.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => { 
                setIsViewDialogOpen(false);
                handleEditClick(selectedApplication);
              }}>
                Edit Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Application Dialog */}
      {selectedApplication && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update the status and details of your application
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Application Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Interview Scheduled">Interview Scheduled</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Offer Received">Offer Received</SelectItem>
                    <SelectItem value="Offer Accepted">Offer Accepted</SelectItem>
                    <SelectItem value="Offer Declined">Offer Declined</SelectItem>
                    <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {status === "Interview Scheduled" && (
                <div className="space-y-2">
                  <Label htmlFor="interviewDate">Interview Date & Time</Label>
                  <Input
                    id="interviewDate"
                    type="datetime-local"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this application"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateApplication.isPending}>
                  {updateApplication.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Application Dialog */}
      {selectedApplication && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Application</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this application? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="font-medium">
                {selectedApplication.job?.title || "Unknown Position"} at {selectedApplication.job?.organization || "Unknown Organization"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Applied on {format(new Date(selectedApplication.createdAt), "MMMM d, yyyy")}
              </p>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
};

export default Applications;
