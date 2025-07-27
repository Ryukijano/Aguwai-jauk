import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, X, Minimize2, Send, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: number;
  content: string;
  isFromUser: boolean;
  timestamp: string;
}

export const AiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch chat messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/chat/messages'],
    enabled: isOpen,
    refetchInterval: false
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
      setInput('');
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !sendMessage.isPending) {
      sendMessage.mutate(input.trim());
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow"
            >
              <MessageSquare className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed z-50 ${
              isMinimized 
                ? 'bottom-6 right-6 w-80' 
                : 'bottom-0 right-0 md:bottom-6 md:right-6 w-full h-full md:w-96 md:h-[600px] md:max-h-[80vh]'
            }`}
          >
            <Card className={`flex flex-col h-full shadow-xl ${
              isMinimized ? 'h-14' : ''
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">AI Assistant</h3>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              {!isMinimized && (
                <>
                  <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                      {messages.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          <p className="text-sm">Hi! I'm your AI assistant.</p>
                          <p className="text-sm">I can help you:</p>
                          <ul className="text-sm mt-2 space-y-1">
                            <li>🔍 Search for teaching jobs</li>
                            <li>📄 Analyze your resume</li>
                            <li>🎯 Prepare for interviews</li>
                            <li>📊 Track applications</li>
                          </ul>
                        </div>
                      )}
                      
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.isFromUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              message.isFromUser
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {sendMessage.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted p-3 rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <form onSubmit={handleSubmit} className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything..."
                        disabled={sendMessage.isPending}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={!input.trim() || sendMessage.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};