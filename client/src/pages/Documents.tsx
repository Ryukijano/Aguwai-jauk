import { useState, useRef } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Document } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const Documents = () => {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isGoogleDriveDialogOpen, setIsGoogleDriveDialogOpen] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    documentId: number | null;
  }>({ isOpen: false, documentId: null });
  const [category, setCategory] = useState("All");
  const [uploadCategory, setUploadCategory] = useState("Resume");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Filter documents by category
  const filteredDocuments = documents
    ? category === "All"
      ? documents
      : documents.filter((doc) => doc.category === category)
    : [];

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

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return <FileText size={24} className="text-red-500" />;
    } else if (fileType.includes("image")) {
      return <FileImage size={24} className="text-blue-500" />;
    } else if (
      fileType.includes("doc") ||
      fileType.includes("word") ||
      fileType.includes("text")
    ) {
      return <FileText size={24} className="text-primary-500" />;
    } else {
      return <File size={24} className="text-gray-500" />;
    }
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
                        {getFileIcon(document.fileType)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {document.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`
                            ${
                              document.category === "Resume"
                                ? "bg-blue-100 text-blue-700"
                                : document.category === "Cover Letter"
                                ? "bg-green-100 text-green-700"
                                : document.category === "Certificate"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                            }
                            border-0
                          `}
                        >
                          {document.category || "Other"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(document.createdAt),
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
                              href={document.fileUrl}
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
