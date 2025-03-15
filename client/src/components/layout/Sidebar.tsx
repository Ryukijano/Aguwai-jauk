import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home,
  Briefcase,
  FileText,
  Bot,
  Calendar,
  Folder,
  BarChart2,
  Link as LinkIcon,
  Settings,
  HelpCircle
} from "lucide-react";

interface NavItemProps {
  icon: React.ReactNode;
  text: string;
  href: string;
  isActive: boolean;
}

const NavItem = ({ icon, text, href, isActive }: NavItemProps) => {
  return (
    <Link href={href}
      className={`px-4 py-2 rounded-lg flex items-center space-x-3 transition ${
        isActive 
          ? "bg-primary-50 text-primary-600 font-medium" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      <span>{text}</span>
    </Link>
  );
};

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar = ({ isMobileOpen = false, onCloseMobile }: SidebarProps) => {
  const [location] = useLocation();
  
  return (
    <aside 
      className={`
        bg-white shadow-md md:w-64 md:flex-shrink-0 md:fixed md:h-screen 
        overflow-y-auto transition-all duration-300 z-10
        ${isMobileOpen ? "fixed inset-0 z-50" : "md:relative"}
      `}
    >
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="bg-primary-500 text-white p-1 rounded">
              <Briefcase size={20} />
            </span>
            <span className="text-xl font-heading font-bold text-gray-800">Aguwai Jauk</span>
          </Link>
          
          {isMobileOpen && (
            <button 
              onClick={onCloseMobile}
              className="md:hidden text-gray-500 hover:text-primary-500"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          )}
        </div>
        
        <div className="space-y-4 flex-grow">
          <NavItem 
            icon={<Home size={18} />}
            text="Dashboard"
            href="/"
            isActive={location === "/" || location === ""}
          />
          
          <NavItem 
            icon={<Briefcase size={18} />}
            text="Job Listings"
            href="/jobs"
            isActive={location === "/jobs"}
          />
          
          <NavItem 
            icon={<FileText size={18} />}
            text="My Applications"
            href="/applications"
            isActive={location === "/applications"}
          />
          
          <NavItem 
            icon={<Bot size={18} />}
            text="AI Assistant"
            href="/ai-assistant"
            isActive={location === "/ai-assistant"}
          />
          
          <NavItem 
            icon={<Calendar size={18} />}
            text="Calendar"
            href="/calendar"
            isActive={location === "/calendar"}
          />
          
          <NavItem 
            icon={<Folder size={18} />}
            text="Documents"
            href="/documents"
            isActive={location === "/documents"}
          />
          
          <NavItem 
            icon={<BarChart2 size={18} />}
            text="Job Tracker"
            href="/job-tracker"
            isActive={location === "/job-tracker"}
          />
          
          <NavItem 
            icon={<LinkIcon size={18} />}
            text="My Profile"
            href="/profile"
            isActive={location === "/profile"}
          />
        </div>
        
        <div className="mt-auto pt-6 border-t border-gray-100">
          <NavItem
            icon={<Settings size={18} className="mr-3" />}
            text="Settings"
            href="/settings"
            isActive={location === "/settings"}
          />
          
          <NavItem
            icon={<HelpCircle size={18} className="mr-3" />}
            text="Help Center"
            href="/help"
            isActive={location === "/help"}
          />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
