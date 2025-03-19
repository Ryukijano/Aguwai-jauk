import { useState } from "react";
import { Bell, Mail, Search, Menu, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

const Header = ({ onOpenMobileMenu }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/jobs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center md:hidden">
          <button 
            onClick={onOpenMobileMenu}
            className="text-gray-500"
          >
            <Menu size={24} />
          </button>
        </div>

        <div className="ml-4 md:ml-0 relative">
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="relative">
              <Search 
                className="absolute left-3 top-2.5 text-gray-500" 
                size={16} 
              />
              <Input
                type="text"
                placeholder="Search jobs..."
                className="py-2 pl-10 pr-4 rounded-full bg-gray-100 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="flex items-center space-x-4">
          <button className="text-gray-500 hover:text-primary-500">
            <Bell size={20} />
          </button>
          <button className="text-gray-500 hover:text-primary-500">
            <Mail size={20} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <Avatar>
                  <AvatarImage 
                    src={user?.profilePicture || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} 
                    alt={user?.name || "User"} 
                  />
                  <AvatarFallback>
                    <User size={20} />
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;