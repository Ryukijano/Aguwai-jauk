import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, MapPin, Briefcase, GraduationCap, Save, Bell, BellOff, History } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest, queryClient } from '@/lib/queryClient';

const profileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
  experience: z.string().optional(),
  education: z.string().optional(),
  skills: z.string().optional()
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const Profile: React.FC = () => {
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/me']
  });
  
  const { data: emailPreferences, isLoading: loadingPrefs } = useQuery({
    queryKey: ['/api/users/email-preferences']
  });
  
  const { data: notifications } = useQuery({
    queryKey: ['/api/notifications']
  });
  
  const updateProfile = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          skills: data.skills ? data.skills.split(',').map(s => s.trim()) : []
        })
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/me'] });
    }
  });
  
  const updateEmailPreferences = useMutation({
    mutationFn: async (preferences: any) => {
      return apiRequest('/api/users/email-preferences', 'PUT', preferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/email-preferences'] });
      toast({
        title: 'Email preferences updated',
        description: 'Your email notification settings have been saved.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update email preferences',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/test-email', 'POST', {});
    },
    onSuccess: (data) => {
      toast({
        title: 'Test email sent',
        description: `Test email has been queued to ${data.recipient}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send test email',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      bio: user?.bio || '',
      experience: user?.experience || '',
      education: user?.education || '',
      skills: user?.skills?.join(', ') || ''
    }
  });
  
  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };
  
  const handlePreferenceToggle = (key: string, value: boolean) => {
    const updatedPreferences = {
      ...emailPreferences,
      [key]: value
    };
    updateEmailPreferences.mutate(updatedPreferences);
  };
  
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal and professional information
        </p>
      </div>
      
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{user?.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold">{user?.fullName || user?.username}</h2>
              <p className="text-muted-foreground">@{user?.username}</p>
              <Button className="mt-2" variant="outline" size="sm">
                Change Avatar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    {...register('fullName')}
                    placeholder="Enter your full name"
                    className="pl-10"
                    data-testid="input-fullname"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="your.email@example.com"
                    className="pl-10"
                    data-testid="input-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder="+91 12345 67890"
                    className="pl-10"
                    data-testid="input-phone"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder="City, State"
                    className="pl-10"
                    data-testid="input-address"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                {...register('bio')}
                placeholder="Tell us about yourself..."
                rows={3}
                data-testid="textarea-bio"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Professional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="experience">
                <Briefcase className="inline h-4 w-4 mr-2" />
                Experience
              </Label>
              <Textarea
                id="experience"
                {...register('experience')}
                placeholder="Describe your teaching experience..."
                rows={4}
                data-testid="textarea-experience"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="education">
                <GraduationCap className="inline h-4 w-4 mr-2" />
                Education
              </Label>
              <Textarea
                id="education"
                {...register('education')}
                placeholder="List your educational qualifications..."
                rows={3}
                data-testid="textarea-education"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                {...register('skills')}
                placeholder="Mathematics, Science, English (comma separated)"
                data-testid="input-skills"
              />
              <p className="text-sm text-muted-foreground">
                Separate skills with commas
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">
            <Save className="h-4 w-4 mr-2" />
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
      
      {/* Email Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preferences" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preferences" data-testid="tab-email-preferences">Preferences</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-email-history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preferences" className="space-y-4 mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between" data-testid="preference-application-updates">
                  <div className="space-y-0.5">
                    <Label htmlFor="applicationUpdates">Application Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive emails when your application status changes
                    </p>
                  </div>
                  <Switch
                    id="applicationUpdates"
                    checked={emailPreferences?.applicationUpdates ?? true}
                    onCheckedChange={(checked) => handlePreferenceToggle('applicationUpdates', checked)}
                    disabled={loadingPrefs || updateEmailPreferences.isPending}
                    data-testid="switch-application-updates"
                  />
                </div>
                
                <div className="flex items-center justify-between" data-testid="preference-job-alerts">
                  <div className="space-y-0.5">
                    <Label htmlFor="jobAlerts">Job Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about new jobs matching your preferences
                    </p>
                  </div>
                  <Switch
                    id="jobAlerts"
                    checked={emailPreferences?.jobAlerts ?? true}
                    onCheckedChange={(checked) => handlePreferenceToggle('jobAlerts', checked)}
                    disabled={loadingPrefs || updateEmailPreferences.isPending}
                    data-testid="switch-job-alerts"
                  />
                </div>
                
                <div className="flex items-center justify-between" data-testid="preference-interview-reminders">
                  <div className="space-y-0.5">
                    <Label htmlFor="interviewReminders">Interview Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders about scheduled interviews
                    </p>
                  </div>
                  <Switch
                    id="interviewReminders"
                    checked={emailPreferences?.interviewReminders ?? true}
                    onCheckedChange={(checked) => handlePreferenceToggle('interviewReminders', checked)}
                    disabled={loadingPrefs || updateEmailPreferences.isPending}
                    data-testid="switch-interview-reminders"
                  />
                </div>
                
                <div className="flex items-center justify-between" data-testid="preference-weekly-digest">
                  <div className="space-y-0.5">
                    <Label htmlFor="weeklyDigest">Weekly Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly summary of new jobs and application updates
                    </p>
                  </div>
                  <Switch
                    id="weeklyDigest"
                    checked={emailPreferences?.weeklyDigest ?? false}
                    onCheckedChange={(checked) => handlePreferenceToggle('weeklyDigest', checked)}
                    disabled={loadingPrefs || updateEmailPreferences.isPending}
                    data-testid="switch-weekly-digest"
                  />
                </div>
                
                <div className="flex items-center justify-between" data-testid="preference-marketing-emails">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketingEmails">Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">
                      Promotional content and special offers
                    </p>
                  </div>
                  <Switch
                    id="marketingEmails"
                    checked={emailPreferences?.marketingEmails ?? false}
                    onCheckedChange={(checked) => handlePreferenceToggle('marketingEmails', checked)}
                    disabled={loadingPrefs || updateEmailPreferences.isPending}
                    data-testid="switch-marketing-emails"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => testEmailMutation.mutate()}
                  disabled={testEmailMutation.isPending}
                  variant="outline"
                  className="w-full"
                  data-testid="button-test-email"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="mt-6">
              <ScrollArea className="h-[400px] pr-4">
                {notifications && notifications.length > 0 ? (
                  <div className="space-y-4">
                    {notifications.map((notification: any) => (
                      <div key={notification.id} className="p-4 border rounded-lg" data-testid={`notification-${notification.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium text-sm">
                              {notification.subject || notification.type.replace(/_/g, ' ').toLowerCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {notification.recipient}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatNotificationDate(notification.createdAt)}
                            </p>
                          </div>
                          <Badge 
                            variant={notification.status === 'sent' ? 'default' : notification.status === 'failed' ? 'destructive' : 'secondary'}
                            data-testid={`badge-status-${notification.id}`}
                          >
                            {notification.status}
                          </Badge>
                        </div>
                        {notification.error && (
                          <p className="text-xs text-destructive mt-2">
                            Error: {notification.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No email notifications yet</p>
                    <p className="text-sm mt-2">Your email history will appear here</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};