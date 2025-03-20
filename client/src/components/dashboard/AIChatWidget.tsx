import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const AIChatWidget = () => {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai/chat-history"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", { message });
      return response.json();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim()) {
      sendMessage.mutate(message);
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

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-gray-800 flex items-center">
            <span className="bg-primary-500 w-2 h-2 rounded-full mr-2 animate-pulse"></span>
            AI Assistant
          </h2>
          <div className="flex items-center gap-2">
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

      <div className="p-3 h-60 flex flex-col">
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
                  <p className="text-sm text-gray-800">{msg.content}</p>
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
                  Hello! I'm your AI assistant. I can help you with:
                  - Finding relevant teaching jobs
                  - Writing application materials
                  - Interview preparation
                  - Career advice
                  What would you like help with?
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-3 mt-auto">
          <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2">
            <Input
              type="text"
              placeholder="Type your message..."
              className="bg-transparent border-0 shadow-none focus-visible:ring-0 flex-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendMessage.isPending}
            />
            <Button 
              type="submit"
              size="icon"
              className="bg-primary-500 hover:bg-primary-600 text-white rounded-full w-8 h-8 ml-2"
              disabled={sendMessage.isPending || !message.trim()}
            >
              <Send size={16} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIChatWidget;