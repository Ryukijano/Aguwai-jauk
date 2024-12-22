import React from 'react';
import { Building2, MapPin, GraduationCap, Clock } from 'lucide-react';
import { Job } from '../../types/job';
import { formatDate } from '../../lib/utils/date';
import { formatSalary, formatLocation } from '../../lib/utils/format';

interface JobListItemProps {
  job: Job;
  onApply: (jobId: string) => void;
}

export function JobListItem({ job, onApply }: JobListItemProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
          
          <div className="mt-2 space-y-2">
            <div className="flex items-center text-gray-600">
              <Building2 className="h-4 w-4 mr-2" />
              <span>{job.school}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 mr-2" />
              <span>{formatLocation(job.location.city, job.location.district)}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <GraduationCap className="h-4 w-4 mr-2" />
              <span>{job.subject} • {job.experience}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-medium text-gray-900">
            {formatSalary(job.salary.min)} - {formatSalary(job.salary.max)}
          </div>
          <div className="mt-1 text-sm text-gray-500">{job.type}</div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center text-gray-500 text-sm">
          <Clock className="h-4 w-4 mr-1" />
          <span>Posted {formatDate(job.postedDate)}</span>
        </div>
        
        <button
          onClick={() => onApply(job.id)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Apply Now
        </button>
      </div>
    </div>
  );
}