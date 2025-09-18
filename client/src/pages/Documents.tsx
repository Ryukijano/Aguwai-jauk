import { useState, useRef, useEffect, useCallback } from "react";
import { useAIContextPublisher } from "@/contexts/AIPageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Folder,
  File,
  Upload,
  FileText,
  FileImage,
  Trash2,
  Download,
  Plus,
  ExternalLink,
  BrainCircuit,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Document } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Star, StarOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// AI Analysis Interface
interface AIAnalysisResult {
  overallScore: number;
  qualificationScore: {
    education: number;
    experience: number;
    certifications: number;
    skills: number;
  };
  extractedData: {
    skills: string[];
    education: string[] | string;
    experience: string;
    certifications: string[];
  };
  strengths: string[];
  improvements: string[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  jobMatches: {
    government: number;
    private: number;
    centralSchools: number;
  };
  confidence: number;
}

const Documents = () => {
  const { publishContext } = useAIContextPublisher();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isResumeUploadDialogOpen, setIsResumeUploadDialogOpen] = useState(false);
  const [isGoogleDriveDialogOpen, setIsGoogleDriveDialogOpen] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    documentId: number | null;
  }>({ isOpen: false, documentId: null });
  const [category, setCategory] = useState("All");
  const [uploadCategory, setUploadCategory] = useState("Resume");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  
  // New state for drag-and-drop and AI analysis
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });
  
  const { data: resumesData, isLoading: isLoadingResumes } = useQuery<{
    resumes: Document[];
    count: number;
    limit: number;
  }>({
    queryKey: ["/api/documents/resumes"],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    }
  });

  // Filter documents by category
  const filteredDocuments = documents
    ? category === "All"
      ? documents
      : documents.filter((doc) => doc?.type === category)
    : [];
  
  // Publish context when documents or selection changes
  useEffect(() => {
    // Skip if still loading
    if (isLoading || isLoadingResumes) return;
    
    try {
      const visibleDocuments = (filteredDocuments || []).slice(0, 3).map((doc) => ({
        id: doc?.id || 0,
        name: doc?.name || 'Unnamed Document',
        type: doc?.type || 'Other'
      }));
      
      const selection = selectedDocumentId ? {
        documentId: selectedDocumentId
      } : undefined;
      
      publishContext({
        route: window.location.pathname,
        page: 'Documents',
        selection,
        visibleSummary: {
          documents: visibleDocuments
        }
      });
    } catch (error) {
      console.debug('Failed to publish Documents context:', error);
    }
  }, [filteredDocuments, selectedDocumentId, publishContext, isLoading, isLoadingResumes]);

  // File upload mutation
  const uploadDocument = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadCategory("Resume");
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocument = useMutation({
    mutationFn: async (documentId: number) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeleteConfirmDialog({ isOpen: false, documentId: null });
      toast({
        title: "Document deleted",
        description: "Your document has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", uploadCategory);

    uploadDocument.mutate(formData);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmDialog.documentId) {
      deleteDocument.mutate(deleteConfirmDialog.documentId);
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File size={24} className="text-gray-500" />;
    
    if (mimeType.includes("pdf")) {
      return <FileText size={24} className="text-red-500" />;
    } else if (mimeType.includes("image")) {
      return <FileImage size={24} className="text-blue-500" />;
    } else if (
      mimeType.includes("doc") ||
      mimeType.includes("word") ||
      mimeType.includes("text")
    ) {
      return <FileText size={24} className="text-primary-500" />;
    } else {
      return <File size={24} className="text-gray-500" />;
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(f => 
      f.type === 'application/pdf' || 
      f.type.includes('wordprocessingml') ||
      f.type === 'application/msword'
    );
    
    if (validFile) {
      setSelectedResumeFile(validFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please drop a PDF or Word document",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Upload resume mutation with AI analysis
  const uploadResume = useMutation({
    mutationFn: async (formData: FormData) => {
      setUploadProgress(0);
      setIsAnalyzing(true);
      
      const response = await fetch("/api/documents/resume", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload resume");
      }

      const result = await response.json();
      
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/resumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
      // If AI analysis is included in the response, display it
      if (data.analysis) {
        setAnalysisResult(data.analysis);
        setShowAnalysisDialog(true);
        toast({
          title: "Resume analyzed successfully",
          description: `AI Score: ${data.analysis.overallScore}/100`,
        });
      } else {
        toast({
          title: "Resume uploaded",
          description: "Your resume has been uploaded successfully",
        });
      }
      
      setIsResumeUploadDialogOpen(false);
      setSelectedResumeFile(null);
      setUploadProgress(0);
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      setIsAnalyzing(false);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Set default resume mutation
  const setDefaultResume = useMutation({
    mutationFn: async (documentId: number) => {
      await apiRequest("PATCH", `/api/documents/${documentId}/default`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/resumes"] });
      toast({
        title: "Default resume updated",
        description: "Your default resume has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update default resume. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleResumeUpload = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedResumeFile) {
      toast({
        title: "No file selected",
        description: "Please select a resume file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedResumeFile);

    uploadResume.mutate(formData);
  };
  
  const handleSetDefault = (resumeId: number) => {
    setDefaultResume.mutate(resumeId);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-800">
              Documents
            </h1>
            <p className="text-gray-500">
              Manage your resumes, cover letters, and teaching certificates
            </p>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsGoogleDriveDialogOpen(true)}
            >
              <ExternalLink size={16} className="mr-2" /> Connect Google Drive
            </Button>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload size={16} className="mr-2" /> Upload Document
            </Button>
          </div>
        </div>

        {/* Resume Management Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-800">
                  Resume Management
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload and manage your resumes for job applications (Max 5 resumes)
                </p>
              </div>
              <Button 
                onClick={() => setIsResumeUploadDialogOpen(true)}
                disabled={resumesData && resumesData.count >= resumesData.limit}
              >
                <Upload size={16} className="mr-2" /> Upload Resume
              </Button>
            </div>
          </div>

          <div className="p-6">
            {isLoadingResumes ? (
              <div className="text-center py-8">
                <FileText
                  className="inline-block animate-pulse text-primary-500 mb-4"
                  size={40}
                />
                <p>Loading resumes...</p>
              </div>
            ) : !resumesData || resumesData?.resumes?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="inline-block mb-4" size={40} />
                <p className="mb-2">No resumes uploaded yet</p>
                <Button
                  variant="link"
                  onClick={() => setIsResumeUploadDialogOpen(true)}
                >
                  Upload your first resume
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {(resumesData?.resumes || []).map((resume) => (
                  <div
                    key={resume.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={24} className="text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">
                            {resume?.name || 'Unnamed Resume'}
                          </p>
                          {resume?.isDefault && (
                            <Badge className="bg-green-100 text-green-700">
                              <Star size={12} className="mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Uploaded {resume?.uploadedAt ? format(new Date(resume.uploadedAt), "MMM d, yyyy") : 'Unknown date'}
                          {resume?.size && ` • ${(resume.size / 1024).toFixed(1)} KB`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!resume?.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(resume.id)}
                          disabled={setDefaultResume.isPending}
                        >
                          <StarOff size={14} className="mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a
                          href={resume.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={16} />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteConfirmDialog({
                            isOpen: true,
                            documentId: resume.id,
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                {resumesData?.count >= resumesData?.limit && (
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      You've reached the maximum limit of {resumesData.limit} resumes.
                      Delete an existing resume to upload a new one.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Other Documents Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-heading font-semibold text-gray-800">
                Your Documents
              </h2>

              <div className="flex items-center space-x-2">
                <Label htmlFor="category-filter" className="text-sm">
                  Filter by:
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category-filter" className="w-[180px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    <SelectItem value="Resume">Resumes</SelectItem>
                    <SelectItem value="Cover Letter">Cover Letters</SelectItem>
                    <SelectItem value="Certificate">Certificates</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <Folder
                  className="inline-block animate-pulse text-primary-500 mb-4"
                  size={40}
                />
                <p>Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Folder className="inline-block mb-4" size={40} />
                <p className="mb-2">No documents found in this category</p>
                <Button
                  variant="link"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  Upload your first document
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        {getFileIcon(document.mimeType)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {document.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`
                            ${
                              document.type === "Resume"
                                ? "bg-blue-100 text-blue-700"
                                : document.type === "Cover Letter"
                                ? "bg-green-100 text-green-700"
                                : document.type === "Certificate"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                            }
                            border-0
                          `}
                        >
                          {document.type || "Other"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(document.uploadedAt),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a
                              href={document.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download size={16} />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteConfirmDialog({
                                isOpen: true,
                                documentId: document.id,
                              })
                            }
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
          </div>
        </div>
      </div>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a resume, cover letter, or certificate
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Document Category</Label>
              <Select
                value={uploadCategory}
                onValueChange={setUploadCategory}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Resume">Resume</SelectItem>
                  <SelectItem value="Cover Letter">Cover Letter</SelectItem>
                  <SelectItem value="Certificate">Certificate</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                <input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      <FileText size={36} className="text-primary-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {selectedFile.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      <Upload size={36} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        Drag and drop files here or click to browse
                      </p>
                      <p className="text-gray-500 text-sm">
                        Supports PDF, DOC, DOCX, and TXT (max 10MB)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedFile || uploadDocument.isPending}
              >
                {uploadDocument.isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Google Drive Connection Dialog */}
      <Dialog
        open={isGoogleDriveDialogOpen}
        onOpenChange={setIsGoogleDriveDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Google Drive</DialogTitle>
            <DialogDescription>
              Connect your Google Drive to store and manage your documents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">
                Benefits of connecting:
              </h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Automatically back up your documents to Google Drive
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Access your documents from any device
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Share documents easily with schools and recruiters
                </li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsGoogleDriveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-primary-500 hover:bg-primary-600 text-white">
                <ExternalLink size={16} className="mr-2" />
                Connect Google Drive
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume Upload Dialog with Drag & Drop */}
      <Dialog 
        open={isResumeUploadDialogOpen} 
        onOpenChange={(open) => {
          setIsResumeUploadDialogOpen(open);
          if (!open) {
            setSelectedResumeFile(null);
            setIsDragging(false);
            setUploadProgress(0);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Resume</DialogTitle>
            <DialogDescription>
              Upload your resume in PDF or DOCX format (max 2MB) for AI analysis
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResumeUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resumeFile">Resume File</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
                  isDragging 
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10" 
                    : "border-gray-200 hover:border-primary-400",
                  (uploadResume.isPending || isAnalyzing) && "pointer-events-none opacity-60"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploadResume.isPending && resumeFileInputRef.current?.click()}
              >
                <input
                  id="resumeFile"
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedResumeFile(e.target.files[0]);
                    }
                  }}
                  ref={resumeFileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.doc"
                  disabled={uploadResume.isPending || isAnalyzing}
                />

                {uploadResume.isPending || isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      {isAnalyzing ? (
                        <BrainCircuit size={48} className="text-primary-500 animate-pulse" />
                      ) : (
                        <Loader2 size={48} className="text-primary-500 animate-spin" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 mb-2">
                        {isAnalyzing ? "Analyzing with AI..." : "Uploading resume..."}
                      </p>
                      <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">{uploadProgress}% complete</p>
                    </div>
                  </div>
                ) : selectedResumeFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="p-3 bg-primary-100 rounded-full">
                        <FileText size={40} className="text-primary-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {selectedResumeFile.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {(selectedResumeFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          resumeFileInputRef.current?.click();
                        }}
                      >
                        <RefreshCw size={14} className="mr-1" />
                        Change File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <Upload size={48} className={cn(
                        "transition-colors",
                        isDragging ? "text-primary-500" : "text-gray-400"
                      )} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">
                        {isDragging ? "Drop your resume here" : "Drag & drop your resume"}
                      </p>
                      <p className="text-gray-500 text-sm">
                        or click to browse • PDF or DOCX (max 2MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload tips */}
            {!uploadResume.isPending && !isAnalyzing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">AI Analysis will include:</p>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Overall qualification score</li>
                      <li>• Skills and experience assessment</li>
                      <li>• Job matching recommendations</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsResumeUploadDialogOpen(false);
                  setSelectedResumeFile(null);
                  setUploadProgress(0);
                }}
                disabled={uploadResume.isPending || isAnalyzing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedResumeFile || uploadResume.isPending || isAnalyzing}
              >
                {uploadResume.isPending || isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {isAnalyzing ? "Analyzing..." : "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Results Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="text-primary-500" />
              AI Resume Analysis Results
            </DialogTitle>
            <DialogDescription>
              Comprehensive analysis of your resume for teaching positions
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-6">
              {/* Overall Score Card */}
              <Card className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                        Overall Score
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        Based on teaching position requirements
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary-600">
                        {analysisResult.overallScore}
                      </div>
                      <div className="text-sm text-gray-500">out of 100</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Qualification Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="text-primary-500" size={20} />
                    Qualification Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(analysisResult.qualificationScore).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize text-gray-700 dark:text-gray-300">
                          {key}
                        </span>
                        <span className="font-medium">{value}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Job Matching */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="text-green-500" size={20} />
                    Job Match Percentages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {analysisResult.jobMatches.government}%
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Government
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {analysisResult.jobMatches.private}%
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Private
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {analysisResult.jobMatches.centralSchools}%
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Central Schools
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths and Improvements */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="text-green-500" size={20} />
                      Key Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysisResult.strengths.map((strength, idx) => (
                        <li key={idx} className="flex gap-2">
                          <CheckCircle2 className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {strength}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="text-yellow-500" size={20} />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysisResult.improvements.map((improvement, idx) => (
                        <li key={idx} className="flex gap-2">
                          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={16} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {improvement}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recommended Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysisResult.recommendations.immediate.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                        Immediate Actions
                      </h4>
                      <ul className="space-y-1">
                        {analysisResult.recommendations.immediate.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                            <span className="text-primary-500">•</span> {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisResult.recommendations.shortTerm.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                        Short-term Goals (3-6 months)
                      </h4>
                      <ul className="space-y-1">
                        {analysisResult.recommendations.shortTerm.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                            <span className="text-blue-500">•</span> {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisResult.recommendations.longTerm.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                        Long-term Goals (1-2 years)
                      </h4>
                      <ul className="space-y-1">
                        {analysisResult.recommendations.longTerm.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                            <span className="text-green-500">•</span> {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={() => setShowAnalysisDialog(false)}
              className="w-full sm:w-auto"
            >
              Close Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.isOpen}
        onOpenChange={(isOpen) =>
          setDeleteConfirmDialog({ ...deleteConfirmDialog, isOpen })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteConfirmDialog({ isOpen: false, documentId: null })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Documents;
