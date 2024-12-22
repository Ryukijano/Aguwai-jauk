import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, User } from 'lucide-react';
import { APP_NAME } from '../../config/constants';

export default function Header() {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);

  const handleSearchClick = () => {
    navigate('/jobs');
  };

  const handleNotificationsClick = () => {
    // TODO: Implement notifications panel
    console.log('Notifications clicked');
  };

  const handleProfileClick = () => {
    // TODO: Implement profile/auth
    console.log('Profile clicked');
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-indigo-600">{APP_NAME.ASSAMESE}</span>
            <span className="text-sm text-gray-600">{APP_NAME.ENGLISH}</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/jobs" 
              className="text-gray-700 hover:text-indigo-600 transition-colors"
            >
              Find Jobs
            </Link>
            <Link 
              to="/schools" 
              className="text-gray-700 hover:text-indigo-600 transition-colors"
            >
              Schools
            </Link>
            <Link 
              to="/resources" 
              className="text-gray-700 hover:text-indigo-600 transition-colors"
            >
              Resources
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSearchClick}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button 
              onClick={handleNotificationsClick}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button 
              onClick={handleProfileClick}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}