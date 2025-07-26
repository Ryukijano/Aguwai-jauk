import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const JobTrackerSafe = () => {
  return (
    <MainLayout>
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Job Tracker</CardTitle>
            <CardDescription>Track your job applications</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Job tracking functionality will be available soon.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default JobTrackerSafe;