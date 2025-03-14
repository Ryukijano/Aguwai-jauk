import { 
  Briefcase, 
  FileText, 
  CalendarCheck, 
  Bell, 
  TrendingUp, 
  TrendingDown
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/lib/types";

interface StatCardProps {
  stat: Stat;
}

const StatCard = ({ stat }: StatCardProps) => {
  const iconClasses = `p-3 rounded-full bg-${stat.color}-100 text-${stat.color}-600`;
  
  return (
    <Card className="border border-gray-100">
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={iconClasses}>
            {getIcon(stat.icon)}
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">{stat.label}</h3>
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
          </div>
        </div>
        
        {stat.trend && (
          <div className="mt-4 flex items-center text-sm">
            <span className={`
              flex items-center 
              ${stat.trend.direction === 'up' ? 'text-green-500' : 
                stat.trend.direction === 'down' ? 'text-red-500' : 
                'text-gray-500'}
            `}>
              {stat.trend.direction === 'up' ? <TrendingUp size={16} className="mr-1" /> : 
               stat.trend.direction === 'down' ? <TrendingDown size={16} className="mr-1" /> : 
               null}
              {stat.trend.value}
            </span>
            <span className="text-gray-500 ml-2">{stat.trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const getIcon = (icon: string) => {
  switch (icon) {
    case 'briefcase':
      return <Briefcase size={20} />;
    case 'file-text':
      return <FileText size={20} />;
    case 'calendar-check':
      return <CalendarCheck size={20} />;
    case 'bell':
      return <Bell size={20} />;
    default:
      return <Briefcase size={20} />;
  }
};

interface StatsGridProps {
  stats: Stat[];
}

const StatsGrid = ({ stats }: StatsGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  );
};

export default StatsGrid;
