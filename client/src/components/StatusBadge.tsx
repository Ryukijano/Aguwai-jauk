import { Badge } from '@/components/ui/badge';
import { Clock, Eye, Star, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ApplicationStatus = 'pending' | 'under_review' | 'shortlisted' | 'rejected' | 'accepted';

interface StatusBadgeProps {
  status: ApplicationStatus;
  showIcon?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    icon: Clock,
    description: 'Your application is being reviewed'
  },
  under_review: {
    label: 'Under Review',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    icon: Eye,
    description: 'Your application is being actively reviewed'
  },
  shortlisted: {
    label: 'Shortlisted',
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    icon: Star,
    description: 'You have been shortlisted for this position'
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-700 hover:bg-red-100',
    icon: X,
    description: 'Your application was not successful'
  },
  accepted: {
    label: 'Accepted',
    color: 'bg-green-100 text-green-700 hover:bg-green-100',
    icon: CheckCircle,
    description: 'Congratulations! Your application was accepted'
  }
};

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <Badge 
      className={cn(config.color, 'transition-all duration-200', className)}
      data-testid={`status-badge-${status}`}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export function getStatusDescription(status: ApplicationStatus): string {
  return statusConfig[status]?.description || 'Status unknown';
}

export function getStatusColor(status: ApplicationStatus): string {
  return statusConfig[status]?.color || statusConfig.pending.color;
}