import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  
  const openMobileMenu = () => setIsMobileMenuOpen(true);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  
  // Close mobile menu when route changes
  useEffect(() => {
    closeMobileMenu();
  }, [location]);
  
  // Close mobile menu when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById("sidebar");
      const menuButton = document.getElementById("mobile-menu-button");
      
      if (
        isMobileMenuOpen &&
        sidebar && 
        !sidebar.contains(event.target as Node) &&
        menuButton &&
        !menuButton.contains(event.target as Node)
      ) {
        closeMobileMenu();
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div id="sidebar">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen} 
          onCloseMobile={closeMobileMenu} 
        />
      </div>
      
      <main className="flex-1 md:ml-64 transition-all duration-300">
        <Header onOpenMobileMenu={openMobileMenu} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
