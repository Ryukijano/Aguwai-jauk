import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, Send, X, MessageSquare, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const AIChatPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai/chat-history"],
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/agent-chat", { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/chat-history"] });
      setMessage("");
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
    },
  });

  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message);
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
    <>
      {/* Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-primary-500 hover:bg-primary-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 group"
          >
            <div className="relative">
              <MessageSquare size={24} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              AI Assistant
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 ${
              isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
            } transition-all duration-300`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-primary-100 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-500 text-white p-2 rounded-lg">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">AI Assistant</h3>
                  <p className="text-xs text-gray-600">Powered by OpenAI & Gemini</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-gray-700 h-8 w-8"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-gray-700 h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <div className="flex flex-col h-[calc(100%-72px)]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoading ? (
                    <div className="text-center text-gray-500 text-sm">Loading...</div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.isFromUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] ${
                            msg.isFromUser
                              ? 'bg-primary-500 text-white rounded-2xl rounded-tr-sm'
                              : 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
                          } px-4 py-2.5 shadow-sm`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.isFromUser ? 'text-primary-100' : 'text-gray-400'
                          }`}>
                            {formatMessageTime(msg.timestamp)}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4"
                    >
                      <p className="text-sm text-gray-700">
                        👋 Hello! I'm your AI-powered assistant with advanced capabilities:
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-gray-600">
                        <li className="flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <span>Search and analyze teaching jobs in real-time</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <span>Review and improve your resume & cover letters</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <span>Provide interview preparation and tips</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <span>Track your application status</span>
                        </li>
                      </ul>
                      <p className="mt-3 text-sm font-medium text-gray-700">
                        How can I help you today?
                      </p>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      placeholder="Ask me anything..."
                      className="flex-1 border-gray-200 focus:border-primary-400 focus:ring-primary-400"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={sendMessage.isPending}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="bg-primary-500 hover:bg-primary-600 text-white"
                      disabled={sendMessage.isPending || !message.trim()}
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatPopup;