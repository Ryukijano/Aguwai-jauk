import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  PencilLine, 
  Linkedin, 
  Youtube, 
  Instagram, 
  Globe, 
  Facebook, 
  Twitter, 
  Trash2, 
  Plus 
} from "lucide-react";
import { User as UserType, SocialLink } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const userProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  bio: z.string().optional(),
  qualifications: z.string().optional(),
});

type UserProfileValues = z.infer<typeof userProfileSchema>;

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string().url("Please enter a valid URL"),
  displayName: z.string().optional(),
});

type SocialLinkValues = z.infer<typeof socialLinkSchema>;

const Profile = () => {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddSocialOpen, setIsAddSocialOpen] = useState(false);
  const [socialLinkToDelete, setSocialLinkToDelete] = useState<SocialLink | null>(null);
  const { toast } = useToast();

  const { data: user, isLoading: isLoadingUser } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: socialLinks, isLoading: isLoadingSocialLinks } = useQuery<SocialLink[]>({
    queryKey: ["/api/social-links"],
  });

  const form = useForm<UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      bio: user?.bio || "",
      qualifications: user?.qualifications || "",
    },
  });

  const socialLinkForm = useForm<SocialLinkValues>({
    resolver: zodResolver(socialLinkSchema),
    defaultValues: {
      platform: "LinkedIn",
      url: "",
      displayName: "",
    },
  });

  // Update user profile when form opens
  if (isEditProfileOpen && user && !form.formState.isDirty) {
    form.reset({
      name: user.name || "",
      email: user.email || "",
      bio: user.bio || "",
      qualifications: user.qualifications || "",
    });
  }

  // Update user profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: UserProfileValues) => {
      await apiRequest("PATCH", "/api/auth/user", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditProfileOpen(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add social link mutation
  const addSocialLink = useMutation({
    mutationFn: async (data: SocialLinkValues) => {
      await apiRequest("POST", "/api/social-links", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      setIsAddSocialOpen(false);
      socialLinkForm.reset({
        platform: "LinkedIn",
        url: "",
        displayName: "",
      });
      toast({
        title: "Social link added",
        description: "Your social link has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Add failed",
        description: "Failed to add social link. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete social link mutation
  const deleteSocialLink = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/social-links/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      setSocialLinkToDelete(null);
      toast({
        title: "Social link deleted",
        description: "Your social link has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete social link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmitProfile = (data: UserProfileValues) => {
    updateProfile.mutate(data);
  };

  const onSubmitSocialLink = (data: SocialLinkValues) => {
    addSocialLink.mutate(data);
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "linkedin":
        return <Linkedin size={20} />;
      case "youtube":
        return <Youtube size={20} />;
      case "instagram":
        return <Instagram size={20} />;
      case "facebook":
        return <Facebook size={20} />;
      case "twitter":
        return <Twitter size={20} />;
      case "website":
      default:
        return <Globe size={20} />;
    }
  };

  const getSocialColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "linkedin":
        return "bg-blue-50 text-blue-600 hover:bg-blue-100";
      case "youtube":
        return "bg-red-50 text-red-600 hover:bg-red-100";
      case "instagram":
        return "bg-purple-50 text-purple-600 hover:bg-purple-100";
      case "facebook":
        return "bg-blue-600 text-white hover:bg-blue-700";
      case "twitter":
        return "bg-sky-50 text-sky-600 hover:bg-sky-100";
      case "website":
      default:
        return "bg-gray-50 text-gray-600 hover:bg-gray-100";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800">
            My Profile
          </h1>
          <p className="text-gray-500">
            Manage your personal information and social profiles
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="social">Social Links</TabsTrigger>
            <TabsTrigger value="account">Account Settings</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Update your personal details and qualifications
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditProfileOpen(true)}
                  >
                    <PencilLine size={16} className="mr-2" /> Edit Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingUser ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-1/3 mx-auto" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2 mx-auto" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center mb-6">
                      <Avatar className="w-24 h-24 mb-4">
                        <AvatarImage 
                          src={user?.profilePicture || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} 
                          alt={user?.name || "User"} 
                        />
                        <AvatarFallback className="text-2xl">
                          <User size={32} />
                        </AvatarFallback>
                      </Avatar>
                      <h2 className="text-xl font-bold text-gray-800">{user?.name || "User"}</h2>
                      <p className="text-gray-500 text-sm">{user?.bio || "No bio provided"}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Username</h3>
                        <p className="text-gray-900">{user?.username}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        <p className="text-gray-900">{user?.email || "No email provided"}</p>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500">Qualifications</h3>
                        <p className="text-gray-900">{user?.qualifications || "No qualifications provided"}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Completion</CardTitle>
                <CardDescription>
                  Complete your profile to improve your chances of finding a job
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Profile Completion</span>
                    <span className="text-sm font-medium">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-primary-500 h-2.5 rounded-full" style={{ width: "85%" }}></div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <h4 className="font-medium text-gray-800">Suggested actions:</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        Complete basic information
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        Add qualifications
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">!</span>
                        Upload a profile picture
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">!</span>
                        Add professional social links
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Links Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Social Links</CardTitle>
                    <CardDescription>
                      Manage your online presence and professional profiles
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddSocialOpen(true)}>
                    <Plus size={16} className="mr-2" /> Add Link
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSocialLinks ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between p-4 border rounded-lg animate-pulse">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3" />
                          <div>
                            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-40" />
                          </div>
                        </div>
                        <div className="w-16 h-8 bg-gray-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : socialLinks && socialLinks.length > 0 ? (
                  <div className="space-y-4">
                    {socialLinks.map((link) => (
                      <div key={link.id} className="flex justify-between items-center p-4 border border-gray-100 rounded-lg">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-full ${getSocialColor(link.platform)}`}>
                            {getSocialIcon(link.platform)}
                          </div>
                          <div className="ml-3">
                            <h4 className="font-medium text-gray-800">{link.displayName || link.platform}</h4>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-sm text-primary-500 hover:underline"
                            >
                              {link.url}
                            </a>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => setSocialLinkToDelete(link)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Globe className="inline-block mb-4" size={40} />
                    <p className="mb-2">You haven't added any social links yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => setIsAddSocialOpen(true)}
                    >
                      Add your first social link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Link in Bio</CardTitle>
                <CardDescription>
                  Preview how your social links appear to others
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex flex-col items-center mb-6">
                    <Avatar className="w-20 h-20 mb-4">
                      <AvatarImage 
                        src={user?.profilePicture || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} 
                        alt={user?.name || "User"} 
                      />
                      <AvatarFallback>
                        <User size={28} />
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-lg font-bold text-gray-800">{user?.name || "User"}</h2>
                    <p className="text-gray-500 text-sm text-center max-w-md">{user?.bio || "No bio provided"}</p>
                  </div>

                  <div className="grid gap-3 max-w-sm mx-auto">
                    {socialLinks && socialLinks.length > 0 ? (
                      socialLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center py-3 px-4 rounded-lg transition ${getSocialColor(link.platform)}`}
                        >
                          {getSocialIcon(link.platform)}
                          <span className="ml-2 font-medium">{link.displayName || link.platform}</span>
                        </a>
                      ))
                    ) : (
                      <p className="text-center text-gray-500">No social links to display</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account settings and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Change Password</h3>
                  <p className="text-sm text-gray-500">Update your password to keep your account secure</p>
                  <div className="grid grid-cols-1 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input id="current-password" type="password" placeholder="••••••••" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input id="new-password" type="password" placeholder="••••••••" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input id="confirm-password" type="password" placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button>Update Password</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                  <p className="text-sm text-gray-500">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button variant="destructive" className="mt-2">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Profile Dialog */}
        <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your personal information and qualifications
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your.email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us a little about yourself" 
                          className="resize-none" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        A brief description of your professional background
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualifications</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="List your educational qualifications" 
                          className="resize-none" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        E.g., M.Sc Mathematics, B.Ed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditProfileOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={updateProfile.isPending || !form.formState.isDirty}
                  >
                    {updateProfile.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Social Link Dialog */}
        <Dialog open={isAddSocialOpen} onOpenChange={setIsAddSocialOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Social Link</DialogTitle>
              <DialogDescription>
                Add your social media profiles and professional links
              </DialogDescription>
            </DialogHeader>

            <Form {...socialLinkForm}>
              <form onSubmit={socialLinkForm.handleSubmit(onSubmitSocialLink)} className="space-y-4">
                <FormField
                  control={socialLinkForm.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <FormControl>
                        <select
                          className="w-full border border-gray-300 rounded-md p-2"
                          {...field}
                        >
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Twitter">Twitter</option>
                          <option value="Website">Website</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={socialLinkForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={socialLinkForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="My LinkedIn Profile" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        How you want this link to be displayed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddSocialOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addSocialLink.isPending}
                  >
                    {addSocialLink.isPending ? "Adding..." : "Add Link"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Social Link Dialog */}
        {socialLinkToDelete && (
          <Dialog
            open={socialLinkToDelete !== null}
            onOpenChange={(isOpen) => {
              if (!isOpen) setSocialLinkToDelete(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Social Link</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this social link? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="bg-gray-50 p-4 rounded-lg flex items-center mb-4">
                <div className={`p-2 rounded-full ${getSocialColor(socialLinkToDelete.platform)}`}>
                  {getSocialIcon(socialLinkToDelete.platform)}
                </div>
                <div className="ml-3">
                  <h4 className="font-medium text-gray-800">
                    {socialLinkToDelete.displayName || socialLinkToDelete.platform}
                  </h4>
                  <p className="text-sm text-gray-500">{socialLinkToDelete.url}</p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSocialLinkToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteSocialLink.mutate(socialLinkToDelete.id)}
                  disabled={deleteSocialLink.isPending}
                >
                  {deleteSocialLink.isPending ? "Deleting..." : "Delete Link"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
};

export default Profile;
