import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarRange, Plus, Trash2, Edit, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { Event, CalendarEvent } from "@/lib/types";
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isToday, isSameMonth } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false);
  const [isGoogleSyncDialogOpen, setIsGoogleSyncDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Form state for adding new event
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState("Other");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });
  
  // Convert events to calendar events with colors
  const calendarEvents: CalendarEvent[] = events
    ? events.map((event) => ({
        id: event.id.toString(),
        title: event.title,
        description: event.description || undefined,
        startTime: event.startTime,
        endTime: event.endTime || undefined,
        location: event.location || undefined,
        color: getEventColor(event.type),
      }))
    : [];
  
  function getEventColor(eventType: string | null): string {
    switch (eventType?.toLowerCase()) {
      case "interview":
        return "bg-primary-500";
      case "deadline":
        return "bg-accent-500";
      case "meeting":
        return "bg-green-500";
      case "reminder":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  }
  
  // Filter events for selected date
  const eventsForSelectedDate = selectedDate
    ? calendarEvents.filter((event) => {
        const eventDate = parseISO(event.startTime);
        return isSameDay(eventDate, selectedDate);
      })
    : [];
  
  // Add new event
  const addEvent = useMutation({
    mutationFn: async (eventData: {
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      location: string;
      type: string;
    }) => {
      await apiRequest("POST", "/api/events", eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsAddEventDialogOpen(false);
      resetEventForm();
      toast({
        title: "Event added",
        description: "Your event has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add event. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Sync with Google Calendar
  const syncWithGoogle = async () => {
    try {
      const response = await apiRequest("GET", "/api/calendar/sync", undefined);
      const syncedEvents = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      toast({
        title: "Calendar synced",
        description: `Synced ${syncedEvents.length} events with Google Calendar`,
      });
      
      setIsGoogleSyncDialogOpen(false);
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync with Google Calendar. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventTitle || !eventStart) {
      toast({
        title: "Missing information",
        description: "Please provide at least a title and start time",
        variant: "destructive",
      });
      return;
    }
    
    const startTime = new Date(eventStart);
    const endTime = eventEnd ? new Date(eventEnd) : startTime;
    
    addEvent.mutate({
      title: eventTitle,
      description: eventDescription,
      startTime,
      endTime,
      location: eventLocation,
      type: eventType,
    });
  };
  
  const resetEventForm = () => {
    setEventTitle("");
    setEventDescription("");
    setEventType("Other");
    setEventLocation("");
    setEventStart("");
    setEventEnd("");
  };
  
  // Functions to navigate months
  const nextMonth = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const prevMonth = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  // Determine if a day has events
  const dayHasEvents = (day: Date) => {
    return calendarEvents.some(event => {
      const eventDate = parseISO(event.startTime);
      return isSameDay(eventDate, day);
    });
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-800">Calendar</h1>
            <p className="text-gray-500">Manage your interviews, deadlines, and other important events</p>
          </div>
          
          <div className="flex space-x-2">
            <Button onClick={() => setIsGoogleSyncDialogOpen(true)} variant="outline">
              <CalendarRange size={16} className="mr-2" /> Sync with Google
            </Button>
            <Button onClick={() => setIsAddEventDialogOpen(true)}>
              <Plus size={16} className="mr-2" /> Add Event
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={prevMonth}>
                    <span className="sr-only">Previous month</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextMonth}>
                    <span className="sr-only">Next month</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <div className="grid grid-cols-7 gap-px">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-xs font-medium text-center text-gray-500 py-2"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {isLoading ? (
                    // Loading state for calendar
                    Array.from({ length: 35 }).map((_, index) => (
                      <div
                        key={index}
                        className="min-h-[80px] border border-gray-100 p-1 animate-pulse bg-gray-50"
                      ></div>
                    ))
                  ) : (
                    generateCalendarDays(currentDate, selectedDate, setSelectedDate, dayHasEvents)
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Events for selected day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "No date selected"}
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsAddEventDialogOpen(true)}
                  >
                    <Plus size={16} />
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {eventsForSelectedDate.length} events scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsForSelectedDate.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarIcon className="mx-auto mb-4" size={40} />
                  <p>No events scheduled for this day</p>
                  <Button 
                    variant="link" 
                    onClick={() => setIsAddEventDialogOpen(true)}
                  >
                    Add an event
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventsForSelectedDate.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className={`w-1 h-full rounded-full self-stretch ${event.color}`}></div>
                        <div className="flex-1 ml-3">
                          <h4 className="font-medium text-gray-900">{event.title}</h4>
                          
                          <div className="mt-2 space-y-1 text-sm text-gray-500">
                            <p>{format(parseISO(event.startTime), "h:mm a")}</p>
                            {event.location && <p>{event.location}</p>}
                            {event.description && <p>{event.description}</p>}
                          </div>
                        </div>
                        
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="icon">
                            <Edit size={14} />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Add Event Dialog */}
      <Dialog open={isAddEventDialogOpen} onOpenChange={setIsAddEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
            <DialogDescription>
              Create a new event on your calendar
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddEvent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="Enter event title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Date & Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">End Date & Time (Optional)</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Event Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interview">Interview</SelectItem>
                    <SelectItem value="Deadline">Deadline</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Reminder">Reminder</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  placeholder="Enter location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add event description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddEventDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addEvent.isPending}>
                {addEvent.isPending ? "Adding..." : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Google Sync Dialog */}
      <Dialog open={isGoogleSyncDialogOpen} onOpenChange={setIsGoogleSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync with Google Calendar</DialogTitle>
            <DialogDescription>
              Connect your Google Calendar to keep all your events synchronized
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Benefits of syncing:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Your interviews and deadlines will appear in Google Calendar
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Get notifications on your devices
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Share your schedule with others
                </li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsGoogleSyncDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary-500 hover:bg-primary-600 text-white"
                onClick={syncWithGoogle}
              >
                <ExternalLink size={16} className="mr-2" />
                Connect Google Calendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

// Helper function to generate calendar days
function generateCalendarDays(
  currentDate: Date,
  selectedDate: Date | undefined,
  setSelectedDate: (date: Date) => void,
  dayHasEvents: (date: Date) => boolean
) {
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  
  // Get the first day of the week (0 = Sunday, 1 = Monday, etc.)
  const startingDayOfWeek = firstDayOfMonth.getDay();
  
  // Add days from previous month to fill the first row
  const prevMonthDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    const day = new Date(firstDayOfMonth);
    day.setDate(day.getDate() - (startingDayOfWeek - i));
    prevMonthDays.push(day);
  }
  
  // Add days from next month to fill the last row
  const totalDaysDisplayed = Math.ceil((daysInMonth.length + startingDayOfWeek) / 7) * 7;
  const nextMonthDays = [];
  const daysToAdd = totalDaysDisplayed - (daysInMonth.length + startingDayOfWeek);
  
  for (let i = 1; i <= daysToAdd; i++) {
    const day = new Date(lastDayOfMonth);
    day.setDate(day.getDate() + i);
    nextMonthDays.push(day);
  }
  
  // Combine all days
  const allDays = [...prevMonthDays, ...daysInMonth, ...nextMonthDays];
  
  return allDays.map((day, index) => {
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
    const hasEvents = dayHasEvents(day);
    const isCurrentDay = isToday(day);
    
    return (
      <div
        key={index}
        className={`min-h-[80px] border border-gray-100 p-1 relative ${
          isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
        } ${isSelected ? "ring-2 ring-primary-500" : ""}`}
        onClick={() => setSelectedDate(day)}
      >
        <div className="flex justify-between">
          <span
            className={`text-sm ${
              isCurrentDay
                ? "bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                : ""
            }`}
          >
            {day.getDate()}
          </span>
          
          {hasEvents && (
            <div className="h-2 w-2 bg-primary-500 rounded-full"></div>
          )}
        </div>
      </div>
    );
  });
}

export default Calendar;
