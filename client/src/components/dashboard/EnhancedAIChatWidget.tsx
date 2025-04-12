import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Bot, 
  Send, 
  Trash2, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  FileText, 
  Upload, 
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

const EnhancedAIChatWidget = () => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<"resume" | "coverLetter">("resume");
  const [imagePrompt, setImagePrompt] = useState("");
  const [openFileDialog, setOpenFileDialog] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai/chat-history"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Advanced text message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      try {
        // First try the advanced OpenAI agent endpoint
        const response = await apiRequest("POST", "/api/ai/advanced-chat", { message });
        return response.json();
      } catch (error) {
        console.log("Advanced chat failed, falling back to standard API", error);
        // Fall back to the standard assistant API if the advanced one fails
        const response = await apiRequest("POST", "/api/ai/chat", { message });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      setMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been processed by the AI assistant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Advanced voice message mutation
  const sendVoiceMessage = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');
      
      try {
        // First try the advanced endpoint
        const response = await fetch('/api/ai/advanced-voice', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Advanced voice processing failed');
        }
        
        return await response.json();
      } catch (error) {
        console.log("Advanced voice processing failed, falling back to standard API", error);
        
        // If advanced processing fails, fall back to standard voice API
        const fallbackFormData = new FormData();
        fallbackFormData.append('audio', audioBlob, 'voice-message.webm');
        
        const fallbackResponse = await fetch('/api/ai/voice', {
          method: 'POST',
          body: fallbackFormData,
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Failed to send voice message');
        }
        
        return await fallbackResponse.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      toast({
        title: "Voice message processed",
        description: "Your voice message has been processed by the AI assistant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process voice message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Advanced image analysis mutation
  const analyzeImage = useMutation({
    mutationFn: async ({ image, prompt }: { image: File, prompt: string }) => {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('prompt', prompt);
      
      try {
        // First try the advanced endpoint
        const response = await fetch('/api/ai/advanced-image', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Advanced image analysis failed');
        }
        
        return await response.json();
      } catch (error) {
        console.log("Advanced image analysis failed, falling back to standard API", error);
        
        // If advanced processing fails, fall back to standard image API
        const fallbackFormData = new FormData();
        fallbackFormData.append('image', image);
        fallbackFormData.append('prompt', prompt);
        
        const fallbackResponse = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          body: fallbackFormData,
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Failed to analyze image');
        }
        
        return await fallbackResponse.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      setSelectedImage(null);
      setImagePrompt("");
      setOpenFileDialog(false);
      toast({
        title: "Image analyzed",
        description: "The image has been analyzed by the AI assistant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to analyze image. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Document analysis mutation
  const analyzeDocument = useMutation({
    mutationFn: async ({ document, documentType }: { document: File, documentType: string }) => {
      const formData = new FormData();
      formData.append('document', document);
      formData.append('documentType', documentType);
      
      const response = await fetch('/api/ai/analyze-document', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      setSelectedDocument(null);
      setOpenFileDialog(false);
      toast({
        title: "Document analyzed",
        description: "Your document has been analyzed by the AI assistant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to analyze document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/ai/chat-history");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      toast({
        title: "Chat cleared",
        description: "Your chat history has been cleared.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear chat history. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Text message handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim()) {
      sendMessage.mutate(message);
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        sendVoiceMessage.mutate(audioBlob);
        
        // Stop all tracks of the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      let time = 0;
      setRecordingTime(time);
      recordingTimerRef.current = window.setInterval(() => {
        time += 1;
        setRecordingTime(time);
        
        // Automatically stop recording after 60 seconds
        if (time >= 60) {
          stopRecording();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  // Document upload handler
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedDocument(e.target.files[0]);
    }
  };

  // Submit image for analysis
  const handleImageAnalysis = () => {
    if (selectedImage && imagePrompt.trim()) {
      analyzeImage.mutate({
        image: selectedImage,
        prompt: imagePrompt
      });
    } else {
      toast({
        title: "Missing Information",
        description: "Please select an image and provide a prompt for analysis.",
        variant: "destructive",
      });
    }
  };

  // Submit document for analysis
  const handleDocumentAnalysis = () => {
    if (selectedDocument) {
      analyzeDocument.mutate({
        document: selectedDocument,
        documentType: documentType
      });
    } else {
      toast({
        title: "Missing Document",
        description: "Please select a document to analyze.",
        variant: "destructive",
      });
    }
  };

  const handleClearChat = () => {
    clearChat.mutate();
  };

  // Format time for messages
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "";
    }
  };

  // Format recording time (MM:SS)
  const formatRecordingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-gray-800 flex items-center">
            <span className="bg-primary-500 w-2 h-2 rounded-full mr-2 animate-pulse"></span>
            AI Assistant
          </h2>
          <div className="flex items-center gap-2">
            <Dialog open={openFileDialog} onOpenChange={setOpenFileDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-primary-500"
                >
                  <Upload size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Files for Analysis</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="image">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="image">Image Analysis</TabsTrigger>
                    <TabsTrigger value="document">Document Analysis</TabsTrigger>
                  </TabsList>
                  
                  {/* Image Upload Tab */}
                  <TabsContent value="image" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="image-upload">Upload an image</Label>
                      <Input 
                        id="image-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                      />
                      {selectedImage && (
                        <div className="text-sm text-gray-500">
                          Selected: {selectedImage.name}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="image-prompt">What would you like to know about this image?</Label>
                      <Input
                        id="image-prompt"
                        placeholder="E.g., Is this teaching certificate valid for Assam schools?"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={handleImageAnalysis}
                      disabled={!selectedImage || !imagePrompt.trim() || analyzeImage.isPending}
                    >
                      {analyzeImage.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Analyze Image
                        </>
                      )}
                    </Button>
                  </TabsContent>
                  
                  {/* Document Upload Tab */}
                  <TabsContent value="document" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="document-type">Document Type</Label>
                      <select
                        id="document-type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value as "resume" | "coverLetter")}
                      >
                        <option value="resume">Resume</option>
                        <option value="coverLetter">Cover Letter</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="document-upload">Upload your document</Label>
                      <Input 
                        id="document-upload" 
                        type="file" 
                        accept=".pdf,.doc,.docx,.txt" 
                        onChange={handleDocumentUpload}
                      />
                      {selectedDocument && (
                        <div className="text-sm text-gray-500">
                          Selected: {selectedDocument.name}
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={handleDocumentAnalysis}
                      disabled={!selectedDocument || analyzeDocument.isPending}
                    >
                      {analyzeDocument.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Analyze {documentType === "resume" ? "Resume" : "Cover Letter"}
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-red-500"
              onClick={handleClearChat}
              disabled={clearChat.isPending || messages.length === 0}
            >
              <Trash2 size={16} />
            </Button>
            <div className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
              Online
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 p-3">
          {isLoading ? (
            <div className="text-center text-gray-500 text-sm">Loading chat history...</div>
          ) : messages.length > 0 ? (
            messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex items-start ${msg.isFromUser ? 'justify-end' : 'max-w-[80%]'}`}
              >
                <div 
                  className={`
                    p-3 rounded-lg 
                    ${msg.isFromUser 
                      ? 'bg-gray-100 rounded-tr-none ml-auto' 
                      : 'bg-primary-50 rounded-tl-none'}
                  `}
                >
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatMessageTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-start max-w-[80%]">
              <div className="bg-primary-50 p-3 rounded-lg rounded-tl-none">
                <p className="text-sm text-gray-800">
                  Hello! I'm your enhanced AI assistant. I can help you with:
                  <br/>- Finding relevant teaching jobs
                  <br/>- Analyzing your resume and cover letter
                  <br/>- Interview preparation
                  <br/>- Career advice for teachers in Assam
                  <br/>- Educational certificates and document analysis
                  <br/><br/>You can also speak to me or upload documents and images for analysis!
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-3 mt-auto">
          <div className="flex items-center bg-gray-50 rounded-lg p-2">
            <Button
              type="button"
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              className={`rounded-full h-8 w-8 ${isRecording ? 'animate-pulse' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </Button>
            
            {isRecording && (
              <div className="ml-2 text-xs text-red-500 font-medium">
                Recording... {formatRecordingTime(recordingTime)}
              </div>
            )}
            
            <Input
              type="text"
              placeholder={isRecording ? "Recording... press stop when done" : "Type your message..."}
              className="bg-transparent border-0 shadow-none focus-visible:ring-0 flex-1 mx-2"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isRecording || sendMessage.isPending}
            />
            
            <Button 
              type="submit"
              size="icon"
              className="bg-primary-500 hover:bg-primary-600 text-white rounded-full w-8 h-8"
              disabled={isRecording || sendMessage.isPending || !message.trim()}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedAIChatWidget;