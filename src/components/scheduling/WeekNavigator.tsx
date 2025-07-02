import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import { APP_TIMEZONE } from "@/lib/time";

interface WeekNavigatorProps {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

function formatDate(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "MMM d");
}

const WeekNavigator: React.FC<WeekNavigatorProps> = ({ weekStart, onPrev, onNext, isLoading }) => {
  const weekEnd = addDays(weekStart, 6);
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className={cn("flex items-center hover:border-0 hover:bg-oatbeige/80", {"opacity-30 cursor-not-allowed pointer-events-none":isLoading,})}
        onClick={onPrev}
        disabled={!!isLoading}>
        <ChevronLeft size={16} className="h-4 w-4" />
      </Button>
      <span className="font-medium text-base 2xl:text-lg">
        {formatDate(weekStart)} - {formatDate(weekEnd)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className={cn("flex items-center hover:border-0 hover:bg-oatbeige/80", {"opacity-30 cursor-not-allowed pointer-events-none":isLoading,})}
        onClick={onNext}
        disabled={!!isLoading}>
        <ChevronRight size={16} className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default WeekNavigator; 