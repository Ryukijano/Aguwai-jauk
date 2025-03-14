import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, SocialLink } from "@/lib/types";
import { Linkedin, Youtube, Instagram, Globe, User as UserIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "wouter";

interface SocialButtonProps {
  platform: string;
  url: string;
  displayName: string;
}

const SocialButton = ({ platform, url, displayName }: SocialButtonProps) => {
  const getIcon = () => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return <Linkedin size={16} className="mr-1" />;
      case 'youtube':
        return <Youtube size={16} className="mr-1" />;
      case 'instagram':
        return <Instagram size={16} className="mr-1" />;
      case 'website':
        return <Globe size={16} className="mr-1" />;
      default:
        return <Globe size={16} className="mr-1" />;
    }
  };
  
  const getColorClass = () => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return "bg-blue-50 text-blue-600 hover:bg-blue-100";
      case 'youtube':
        return "bg-red-50 text-red-600 hover:bg-red-100";
      case 'instagram':
        return "bg-purple-50 text-purple-600 hover:bg-purple-100";
      case 'website':
        return "bg-gray-50 text-gray-600 hover:bg-gray-100";
      default:
        return "bg-gray-50 text-gray-600 hover:bg-gray-100";
    }
  };
  
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center px-3 py-1 rounded-full text-sm transition ${getColorClass()}`}
    >
      {getIcon()}
      {displayName || platform}
    </a>
  );
};

interface AddSocialLinkFormProps {
  onClose: () => void;
}

const AddSocialLinkForm = ({ onClose }: AddSocialLinkFormProps) => {
  const [platform, setPlatform] = useState("LinkedIn");
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();
  
  const addSocialLink = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/social-links", {
        platform,
        url,
        displayName: displayName || platform
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      toast({
        title: "Social link added",
        description: `Your ${platform} link has been added successfully.`
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add social link. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }
    addSocialLink.mutate();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="platform">Platform</Label>
        <select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
        >
          <option value="LinkedIn">LinkedIn</option>
          <option value="YouTube">YouTube</option>
          <option value="Instagram">Instagram</option>
          <option value="Website">Website</option>
          <option value="Twitter">Twitter</option>
          <option value="Facebook">Facebook</option>
        </select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name (Optional)</Label>
        <Input
          id="displayName"
          placeholder={platform}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={addSocialLink.isPending}>
          {addSocialLink.isPending ? "Adding..." : "Add Social Link"}
        </Button>
      </div>
    </form>
  );
};

const ProfileBio = () => {
  const [isAddSocialOpen, setIsAddSocialOpen] = useState(false);
  const [, navigate] = useRouter();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  const { data: socialLinks } = useQuery<SocialLink[]>({
    queryKey: ["/api/social-links"],
  });
  
  const { data: applications } = useQuery({
    queryKey: ["/api/applications"],
  });
  
  const statistics = {
    applications: applications?.length || 0,
    interviews: applications?.filter(app => app.status === "Interview Scheduled").length || 0,
    profileComplete: 85, // This would be calculated based on user profile completeness
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 h-24"></div>
      <div className="px-6 pb-6">
        <div className="flex justify-center">
          <Avatar className="w-20 h-20 border-4 border-white -mt-10">
            <AvatarImage 
              src={user?.profilePicture || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} 
              alt={user?.name || "User"} 
            />
            <AvatarFallback>
              <UserIcon size={32} />
            </AvatarFallback>
          </Avatar>
        </div>
        
        <div className="text-center mt-3">
          <h3 className="font-heading font-bold text-gray-900">{user?.name || "User"}</h3>
          <p className="text-gray-500 text-sm">{user?.bio || "No bio provided"}</p>
        </div>
        
        <div className="mt-6 grid grid-cols-3 text-center border-y border-gray-100 py-3">
          <div>
            <p className="text-gray-900 font-semibold">{statistics.applications}</p>
            <p className="text-xs text-gray-500">Applications</p>
          </div>
          <div className="border-x border-gray-100">
            <p className="text-gray-900 font-semibold">{statistics.interviews}</p>
            <p className="text-xs text-gray-500">Interviews</p>
          </div>
          <div>
            <p className="text-gray-900 font-semibold">{statistics.profileComplete}%</p>
            <p className="text-xs text-gray-500">Profile Complete</p>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-700">My Social Profiles</h4>
            <Dialog open={isAddSocialOpen} onOpenChange={setIsAddSocialOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Social Link</DialogTitle>
                </DialogHeader>
                <AddSocialLinkForm onClose={() => setIsAddSocialOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {socialLinks && socialLinks.length > 0 ? (
              socialLinks.map(link => (
                <SocialButton
                  key={link.id}
                  platform={link.platform}
                  url={link.url}
                  displayName={link.displayName || link.platform}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500">No social profiles added yet</p>
            )}
          </div>
        </div>
        
        <div className="mt-6">
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => navigate("/profile")}
          >
            Edit Profile
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileBio;
