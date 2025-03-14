import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Event } from "@/lib/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MiniCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  events: Event[];
}

const MiniCalendar = ({ currentDate, onDateChange, events }: MiniCalendarProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate days from previous and next month to fill the calendar grid
  const startDay = monthStart.getDay(); // 0 for Sunday, 1 for Monday, etc.
  const endDay = 6 - monthEnd.getDay(); // Days needed to complete the last week
  
  // Create array of dates for the calendar
  const daysToDisplay = [];
  
  // Add days from previous month if necessary
  for (let i = startDay; i > 0; i--) {
    const day = new Date(monthStart);
    day.setDate(day.getDate() - i);
    daysToDisplay.push(day);
  }
  
  // Add days from current month
  daysToDisplay.push(...days);
  
  // Add days from next month if necessary
  for (let i = 1; i <= endDay; i++) {
    const day = new Date(monthEnd);
    day.setDate(day.getDate() + i);
    daysToDisplay.push(day);
  }
  
  // Split days into weeks for grid display
  const weeks = [];
  for (let i = 0; i < daysToDisplay.length; i += 7) {
    weeks.push(daysToDisplay.slice(i, i + 7));
  }
  
  const hasEventOnDate = (date: Date) => {
    return events.some(event => {
      const eventDate = parseISO(event.startTime);
      return isSameDay(date, eventDate);
    });
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4 text-sm">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-500 hover:text-gray-700"
          onClick={() => onDateChange(subMonths(currentDate, 1))}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="font-medium">{format(currentDate, 'MMMM yyyy')}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-500 hover:text-gray-700"
          onClick={() => onDateChange(addMonths(currentDate, 1))}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
        <div className="text-gray-500">Su</div>
        <div className="text-gray-500">Mo</div>
        <div className="text-gray-500">Tu</div>
        <div className="text-gray-500">We</div>
        <div className="text-gray-500">Th</div>
        <div className="text-gray-500">Fr</div>
        <div className="text-gray-500">Sa</div>
        
        {weeks.flat().map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const hasEvent = hasEventOnDate(day);
          
          return (
            <div 
              key={index} 
              className={`
                py-1 cursor-pointer
                ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
                ${hasEvent ? 'bg-primary-500 text-white rounded-full font-medium' : ''}
              `}
              onClick={() => onDateChange(day)}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CalendarWidget = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showGoogleSync, setShowGoogleSync] = useState(false);
  const { toast } = useToast();
  
  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });
  
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };
  
  const handleGoogleSync = async () => {
    try {
      const response = await apiRequest("GET", "/api/calendar/sync", undefined);
      const syncedEvents = await response.json();
      
      toast({
        title: "Calendar synced",
        description: `Synced ${syncedEvents.length} events from Google Calendar`,
      });
      
      setShowGoogleSync(false);
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync with Google Calendar. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Filter events based on the current week
  const filteredEvents = events?.filter(event => {
    const eventDate = parseISO(event.startTime);
    return isSameMonth(eventDate, currentDate);
  }).sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
  
  const getEventTypeIcon = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case 'interview':
        return <Video size={16} className="text-primary-500" />;
      case 'deadline':
        return <FileSignature size={16} className="text-accent-500" />;
      default:
        return <CalendarIcon size={16} className="text-gray-500" />;
    }
  };
  
  const getEventTypeStyles = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case 'interview':
        return 'bg-primary-50 border-l-4 border-primary-500';
      case 'deadline':
        return 'bg-accent-50 border-l-4 border-accent-500';
      default:
        return 'bg-gray-50 border-l-4 border-gray-500';
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-gray-800">Upcoming Schedule</h2>
          <Button 
            variant="link" 
            className="text-primary-500 text-sm hover:text-primary-600 font-medium"
            onClick={() => setShowGoogleSync(true)}
          >
            Sync with Google
          </Button>
        </div>
      </div>
      
      <div className="p-6">
        {showGoogleSync ? (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Sync with Google Calendar</h3>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Google Calendar to keep all your interviews and deadlines synchronized.
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="default" 
                className="bg-primary-500 hover:bg-primary-600 text-white"
                onClick={handleGoogleSync}
              >
                Connect Calendar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowGoogleSync(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MiniCalendar 
            currentDate={currentDate} 
            onDateChange={handleDateChange} 
            events={events || []} 
          />
        )}
        
        <div className="space-y-3 mt-6">
          {isLoading ? (
            <div className="text-center text-gray-500">Loading events...</div>
          ) : error ? (
            <div className="text-center text-red-500">Failed to load events</div>
          ) : filteredEvents && filteredEvents.length > 0 ? (
            filteredEvents.map(event => (
              <div key={event.id} className={`flex items-start p-3 rounded-lg ${getEventTypeStyles(event.type)}`}>
                {getEventTypeIcon(event.type)}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">{event.title}</p>
                  <p className="text-xs text-gray-500">
                    {format(parseISO(event.startTime), 'MMM dd, h:mm a')}
                    {event.endTime && ` - ${format(parseISO(event.endTime), 'h:mm a')}`}
                    {event.location && ` • ${event.location}`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500">No upcoming events</div>
          )}
        </div>
        
        <div className="mt-4">
          <Button 
            variant="outline"
            className="w-full text-gray-800"
          >
            <CalendarIcon size={16} className="mr-2" /> Add Event
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalendarWidget;
