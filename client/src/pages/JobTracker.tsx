import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  SheetIcon,
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SheetData {
  range: string;
  values: any[][];
}

const JobTracker = () => {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isAddJobDialogOpen, setIsAddJobDialogOpen] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const { toast } = useToast();

  // Form state for adding job to tracker
  const [jobTitle, setJobTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [status, setStatus] = useState("Applied");
  const [nextStep, setNextStep] = useState("");
  const [deadline, setDeadline] = useState("");

  const { data: sheetData, isLoading, refetch } = useQuery<SheetData>({
    queryKey: ["/api/job-tracker"],
  });

  // Filter out header row
  const jobData = sheetData?.values ? sheetData.values.slice(1) : [];

  // Prepare data for status distribution chart
  const getStatusCounts = () => {
    if (!jobData.length) return [];

    const statusMap: Record<string, number> = {};
    
    jobData.forEach(job => {
      const status = job[3] || "Unknown";
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    return Object.entries(statusMap).map(([name, value]) => ({
      name,
      value
    }));
  };

  const statusData = getStatusCounts();
  
  // Colors for pie chart
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Monthly application data for bar chart
  const getMonthlyData = () => {
    if (!jobData.length) return [];

    const monthMap: Record<string, number> = {};
    
    jobData.forEach(job => {
      if (!job[2]) return; // Skip if no application date
      
      try {
        const date = new Date(job[2]);
        const monthYear = format(date, 'MMM yyyy');
        monthMap[monthYear] = (monthMap[monthYear] || 0) + 1;
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort by date
    return Object.entries(monthMap)
      .map(([month, applications]) => ({
        month,
        applications
      }))
      .sort((a, b) => {
        const [monthA, yearA] = a.month.split(' ');
        const [monthB, yearB] = b.month.split(' ');
        return new Date(`${monthA} 1, ${yearA}`).getTime() - 
               new Date(`${monthB} 1, ${yearB}`).getTime();
      });
  };

  const monthlyData = getMonthlyData();

  const handleSyncSheet = async () => {
    try {
      setIsSyncingSheet(true);
      await refetch();
      toast({
        title: "Sheet synced",
        description: "Your job tracking sheet has been synced successfully",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync job tracking sheet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await apiRequest("POST", "/api/job-tracker", {
        jobTitle,
        organization,
        applicationDate,
        status,
        nextStep,
        deadline
      });
      
      refetch();
      setIsAddJobDialogOpen(false);
      resetForm();
      
      toast({
        title: "Job added",
        description: "Your job has been added to the tracker",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add job to tracker. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setJobTitle("");
    setOrganization("");
    setApplicationDate("");
    setStatus("Applied");
    setNextStep("");
    setDeadline("");
  };

  const handleConnectSheet = () => {
    toast({
      title: "Google Sheets connected",
      description: "Your Google Sheets account has been connected successfully",
    });
    setIsConnectDialogOpen(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  // Status color mapping
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('applied')) return 'bg-blue-100 text-blue-700';
    if (statusLower.includes('interview')) return 'bg-purple-100 text-purple-700';
    if (statusLower.includes('offer')) return 'bg-green-100 text-green-700';
    if (statusLower.includes('rejected')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-800">
              Job Tracker
            </h1>
            <p className="text-gray-500">
              Track and manage your job applications with Google Sheets
            </p>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleSyncSheet}
              disabled={isSyncingSheet}
            >
              <RefreshCw 
                size={16} 
                className={`mr-2 ${isSyncingSheet ? 'animate-spin' : ''}`} 
              /> 
              Sync Sheet
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsConnectDialogOpen(true)}
            >
              <SheetIcon size={16} className="mr-2" /> Connect Sheet
            </Button>
            <Button onClick={() => setIsAddJobDialogOpen(true)}>
              <Plus size={16} className="mr-2" /> Add Job
            </Button>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Applications Overview</CardTitle>
              <CardDescription>
                Summary of your job application statuses
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-48">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p>No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Applications</CardTitle>
              <CardDescription>
                Number of applications per month
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-48">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={monthlyData}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="applications" fill="#4F46E5" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p>No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>
                Your latest job application activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobData.length > 0 ? (
                <div className="space-y-4">
                  {jobData.slice(0, 3).map((job, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-sm">{job[0]}</p>
                        <p className="text-gray-500 text-xs">{job[1]}</p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={getStatusColor(job[3])}
                      >
                        {job[3]}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[168px] flex items-center justify-center text-gray-500">
                  <p>No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Job Tracking Table */}
        <Card>
          <CardHeader>
            <CardTitle>Job Tracking Spreadsheet</CardTitle>
            <CardDescription>
              Track your job applications, status, and next steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <BarChart2
                  className="inline-block animate-pulse text-primary-500 mb-4"
                  size={40}
                />
                <p>Loading job tracker data...</p>
              </div>
            ) : !sheetData || jobData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart
                  className="inline-block mb-4"
                  size={40}
                />
                <p className="mb-2">No job tracking data available</p>
                <Button
                  variant="link"
                  onClick={() => setIsAddJobDialogOpen(true)}
                >
                  Add your first job
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {sheetData.values?.[0].map((header, index) => (
                        <TableHead key={index}>{header}</TableHead>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {jobData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>
                              {cellIndex === 3 ? (
                                <Badge
                                  variant="outline"
                                  className={getStatusColor(cell)}
                                >
                                  {cell}
                                </Badge>
                              ) : cellIndex === 2 || cellIndex === 5 ? (
                                formatDate(cell)
                              ) : (
                                cell
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toast({
                          title: "Opening Google Sheet",
                          description: "Your job tracking sheet is opening in a new tab",
                        });
                      }}
                    >
                      <ExternalLink size={14} className="mr-2" /> Open in Google Sheets
                    </a>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connect Google Sheet Dialog */}
      <Dialog
        open={isConnectDialogOpen}
        onOpenChange={setIsConnectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Google Sheets</DialogTitle>
            <DialogDescription>
              Connect your Google Sheets account to track your job applications
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
                  Track all your applications in one place
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Get insights and analytics on your job search
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Access your tracker from any device
                </li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsConnectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnectSheet}
                className="bg-primary-500 hover:bg-primary-600 text-white"
              >
                <SheetIcon size={16} className="mr-2" />
                Connect Google Sheets
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Job Dialog */}
      <Dialog open={isAddJobDialogOpen} onOpenChange={setIsAddJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Job to Tracker</DialogTitle>
            <DialogDescription>
              Add a new job application to your tracking sheet
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddJob} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="Assistant Teacher (Mathematics)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                placeholder="Government Higher Secondary School, Guwahati"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicationDate">Application Date</Label>
                <Input
                  id="applicationDate"
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="w-full border border-gray-300 rounded-md p-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Applied">Applied</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Offer Received">Offer Received</option>
                  <option value="Offer Accepted">Offer Accepted</option>
                  <option value="Offer Declined">Offer Declined</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nextStep">Next Step</Label>
                <Input
                  id="nextStep"
                  placeholder="Follow up next week"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddJobDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add to Tracker
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default JobTracker;
