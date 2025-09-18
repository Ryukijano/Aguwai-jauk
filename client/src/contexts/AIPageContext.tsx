import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

export type PageType = 'Dashboard' | 'Jobs' | 'JobDetails' | 'Applications' | 'ApplicationDetails' | 'Profile' | 'Documents' | 'Login' | 'Unknown';

export interface PageContext {
  route: string;
  page: PageType;
  params?: Record<string, string>;
  selection?: {
    jobId?: number;
    applicationId?: number;
    documentId?: number;
  };
  visibleSummary?: {
    jobs?: Array<{ id: number; title: string; organization: string; location?: string; category?: string }>;
    totalJobs?: number;
    filters?: { query?: string; location?: string; category?: string; tags?: string[] };
    applications?: Array<{ id: number; jobTitle: string; status: string }>;
    totalApplications?: number;
    job?: { id: number; title: string; organization: string; location?: string; category?: string; requirements?: string };
    stats?: { applications?: number; interviews?: number; offers?: number };
    documents?: Array<{ id: number; name: string; type: string }>;
  };
  timestamp: number;
  version: number;
}

interface AIPageContextType {
  context: PageContext; // Always have a context, never null
  updateContext: (context: Partial<PageContext>) => void;
}

const AIPageContext = createContext<AIPageContextType | null>(null);

export const AIPageContextProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with a default context instead of null
  const [context, setContext] = useState<PageContext>({
    route: window.location.pathname,
    page: 'Unknown',
    timestamp: Date.now(),
    version: 1
  });
  const [version, setVersion] = useState(1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateContext = useCallback((updates: Partial<PageContext>) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce context updates to avoid excessive updates
    debounceTimerRef.current = setTimeout(() => {
      setContext(prev => {
        const newVersion = (prev?.version || 0) + 1;
        const newContext: PageContext = {
          route: updates.route || prev?.route || '',
          page: updates.page || prev?.page || 'Unknown',
          params: updates.params || prev?.params,
          selection: updates.selection || prev?.selection,
          visibleSummary: updates.visibleSummary || prev?.visibleSummary,
          timestamp: Date.now(),
          version: newVersion
        };
        
        // Cap array sizes for performance
        if (newContext.visibleSummary) {
          if (newContext.visibleSummary.jobs) {
            newContext.visibleSummary.jobs = newContext.visibleSummary.jobs.slice(0, 5);
          }
          if (newContext.visibleSummary.applications) {
            newContext.visibleSummary.applications = newContext.visibleSummary.applications.slice(0, 5);
          }
          if (newContext.visibleSummary.documents) {
            newContext.visibleSummary.documents = newContext.visibleSummary.documents.slice(0, 3);
          }
        }
        
        return newContext;
      });
      setVersion(v => v + 1);
    }, 500); // 500ms debounce
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <AIPageContext.Provider value={{ context, updateContext }}>
      {children}
    </AIPageContext.Provider>
  );
};

// Hook for consuming context
export const useAIContext = () => {
  const contextValue = useContext(AIPageContext);
  if (!contextValue) {
    // Return default context if provider not available
    const defaultContext: PageContext = {
      route: window.location.pathname,
      page: 'Unknown',
      timestamp: Date.now(),
      version: 1
    };
    return { 
      context: defaultContext,
      updateContext: () => {}
    };
  }
  return contextValue;
};

// Hook for pages to publish their context
export const useAIContextPublisher = () => {
  const { updateContext } = useAIContext();
  const hasPublishedRef = useRef(false);
  
  const publishContext = useCallback((updates: Partial<PageContext>) => {
    // Skip publishing if no updates provided
    if (!updates) return;
    
    try {
      // Truncate strings to 100 chars for any text fields
      const sanitizedUpdates = { ...updates };
      
      // Add null checks for nested properties
      if (sanitizedUpdates.visibleSummary?.job?.requirements) {
        sanitizedUpdates.visibleSummary.job.requirements = 
          sanitizedUpdates.visibleSummary.job.requirements.substring(0, 100);
      }
      
      // Only update if we have valid data
      if (updateContext) {
        updateContext(sanitizedUpdates);
        hasPublishedRef.current = true;
      }
    } catch (error) {
      // Silently catch any errors to prevent crashes
      console.debug('AIContextPublisher: Failed to publish context', error);
    }
  }, [updateContext]);
  
  // Reset hasPublished flag when component unmounts
  useEffect(() => {
    return () => {
      hasPublishedRef.current = false;
    };
  }, []);
  
  return {
    publishContext,
    hasPublished: hasPublishedRef.current
  };
};

// Utility function to generate context hash for comparison
export const generateContextHash = (context: PageContext | null): string => {
  if (!context) return '';
  
  // Create a simple hash from key properties
  const hashString = `${context.page}-${context.route}-${context.version}-${JSON.stringify(context.params || {})}-${JSON.stringify(context.selection || {})}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(36);
};