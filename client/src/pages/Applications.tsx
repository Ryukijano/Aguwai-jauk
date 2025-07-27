import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Building, MapPin, FileText, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export const Applications: React.FC = () => {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['/api/applications']
  });
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'interview':
        return 'bg-blue-100 text-blue-700';
      case 'shortlisted':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your job applications
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {applications.filter((app: any) => app.status === 'Pending').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {applications.filter((app: any) => app.status === 'interview').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {applications.length > 0 
                ? Math.round((applications.filter((app: any) => app.status === 'accepted').length / applications.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Applications List */}
      <div className="space-y-4">
        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading applications...
            </CardContent>
          </Card>
        )}
        
        {!isLoading && applications.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>You haven't applied to any jobs yet.</p>
              <Button className="mt-4" asChild>
                <a href="/jobs">Browse Jobs</a>
              </Button>
            </CardContent>
          </Card>
        )}
        
        {applications.map((application: any) => (
          <Card key={application.id}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold">Application #{application.id}</h3>
                    <Badge className={getStatusColor(application.status)}>
                      {application.status}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Applied on {new Date(application.appliedAt).toLocaleDateString()}
                    </p>
                    
                    {application.interviewDate && (
                      <p className="flex items-center gap-2 text-blue-600">
                        <Calendar className="h-4 w-4" />
                        Interview on {new Date(application.interviewDate).toLocaleDateString()}
                      </p>
                    )}
                    
                    {application.notes && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm">{application.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  {application.status === 'interview' && (
                    <Button size="sm">
                      Prepare for Interview
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};