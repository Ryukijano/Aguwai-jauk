import { Clock, Eye, Star, X, CheckCircle, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ApplicationStatus } from './StatusBadge';
import type { ApplicationStatusHistory } from '@shared/schema';

// Re-export for backward compatibility
export type StatusHistoryEntry = ApplicationStatusHistory & {
  changedByName?: string;
};

interface ApplicationTimelineProps {
  history: StatusHistoryEntry[];
  currentStatus: ApplicationStatus;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

const statusIcons = {
  pending: Clock,
  under_review: Eye,
  shortlisted: Star,
  rejected: X,
  accepted: CheckCircle
};

const statusColors = {
  pending: 'bg-gray-500',
  under_review: 'bg-blue-500',
  shortlisted: 'bg-purple-500',
  rejected: 'bg-red-500',
  accepted: 'bg-green-500'
};

export function ApplicationTimeline({ 
  history, 
  currentStatus, 
  className,
  orientation = 'vertical' 
}: ApplicationTimelineProps) {
  // Sort history by date (newest first)
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.changedAt || '').getTime() - new Date(a.changedAt || '').getTime()
  );
  
  if (orientation === 'horizontal') {
    return <HorizontalTimeline history={sortedHistory} currentStatus={currentStatus} className={className} />;
  }
  
  return (
    <div className={cn('space-y-4', className)} data-testid="application-timeline">
      {sortedHistory.map((entry, index) => {
        const Icon = statusIcons[entry.status as ApplicationStatus];
        const isLatest = index === 0;
        const isLast = index === sortedHistory.length - 1;
        
        return (
          <div key={entry.id} className="flex gap-4 relative">
            {/* Timeline line */}
            {!isLast && (
              <div 
                className="absolute left-[19px] top-10 w-0.5 h-full bg-border"
                aria-hidden="true"
              />
            )}
            
            {/* Icon */}
            <div className="flex-shrink-0">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white',
                  statusColors[entry.status as ApplicationStatus],
                  isLatest && 'ring-4 ring-offset-2 ring-opacity-50',
                  isLatest && `ring-${statusColors[entry.status as ApplicationStatus].replace('bg-', '')}`
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
            
            {/* Content */}
            <Card className={cn('flex-1 p-4', isLatest && 'border-2')}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold capitalize">
                    {entry.status.replace('_', ' ')}
                  </h4>
                  {isLatest && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Current Status
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {entry.changedAt ? format(new Date(entry.changedAt), 'MMM d, yyyy h:mm a') : 'Unknown'}
                </div>
              </div>
              
              {entry.note && (
                <p className="text-sm text-muted-foreground mb-2">
                  {entry.note}
                </p>
              )}
              
              {entry.changedByName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  Updated by {entry.changedByName}
                </div>
              )}
            </Card>
          </div>
        );
      })}
      
      {/* Estimated timeline */}
      {currentStatus !== 'accepted' && currentStatus !== 'rejected' && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Usually takes 7-10 days for complete review</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function HorizontalTimeline({ history, currentStatus, className }: Omit<ApplicationTimelineProps, 'orientation'>) {
  const statuses: ApplicationStatus[] = ['pending', 'under_review', 'shortlisted', 'accepted'];
  const rejectedIndex = history.findIndex(h => h.status === 'rejected');
  const currentIndex = statuses.indexOf(currentStatus);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-border" />
        <div 
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${(currentIndex / (statuses.length - 1)) * 100}%` }}
        />
        
        {statuses.map((status, index) => {
          const Icon = statusIcons[status as ApplicationStatus];
          const isCompleted = index <= currentIndex;
          const isRejected = status === 'rejected' && rejectedIndex >= 0;
          const historyEntry = history.find(h => h.status === status);
          
          return (
            <div key={status} className="relative flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted || isRejected
                    ? cn('text-white', statusColors[status])
                    : 'bg-muted text-muted-foreground border-2 border-border'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="mt-2 text-center">
                <p className="text-xs font-medium capitalize">
                  {status.replace('_', ' ')}
                </p>
                {historyEntry && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {historyEntry.changedAt ? format(new Date(historyEntry.changedAt), 'MMM d') : 'Unknown'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}