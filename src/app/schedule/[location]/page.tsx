"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { generateWeeklySchedule } from "@/lib/scheduling/scheduleGenerator";
import ScheduleGrid, { type ShiftClickContext } from "@/components/scheduling/ScheduleGrid";
import WeekNavigator from "@/components/scheduling/WeekNavigator";
import { Button } from "@/components/ui/button";
import { EditShiftModal } from "@/components/modals/EditShiftModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppToast } from "@/lib/toast-service";
import { formatLocationName } from "@/lib/utils";
import ScheduleGridSkeleton from "@/components/scheduling/ScheduleGridSkeleton";
import { useSchedulePageData } from "@/hooks/useSchedulePageData";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, addDays, subDays, parse, isValid } from 'date-fns';
import { APP_TIMEZONE } from "@/lib/time";

const CheckmarkIcon = (props: React.ComponentProps<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// Helper to get the start of the week (Monday) in Pacific Time for a given date.
function getWeekStartPT(referenceDate?: Date): Date {
  const date = referenceDate || new Date();
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  return startOfWeek(zonedDate, { weekStartsOn: 1 }); // 1 for Monday
}

const ButtonWrapper: React.FC<{
  isDisabled: boolean;
  showTooltip: boolean;
  tooltipText: string;
  children: React.ReactElement;
}> = ({ isDisabled, showTooltip, tooltipText, children }) => {
  const spanContent = (
    <span
      className={isDisabled ? "inline-block cursor-not-allowed" : "inline-block"}
      tabIndex={showTooltip && isDisabled ? 0 : undefined}
    >
      {React.cloneElement(children, { style: { ...(children.props.style || {}), pointerEvents: isDisabled ? 'none' : 'auto' } })}
    </span>
  );

  if (showTooltip && isDisabled) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>{spanContent}</TooltipTrigger>
          <TooltipContent className="bg-[#F0C4B4]"><p>{tooltipText}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return spanContent;
};

const SchedulePage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccessToast } = useAppToast();
  const locationSlug = params?.location as string;

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartPT());
  const [editMode, setEditMode] = useState(false);
  const [selectedShiftModalContext, setSelectedShiftModalContext] = useState<ShiftClickContext | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPastWeek, setIsPastWeek] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  const { data, error, isLoading, mutate } = useSchedulePageData(locationSlug, weekStart);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const weekParam = searchParams.get('week');
    let derivedMonday: Date;

    if (weekParam) {
      const parsedDate = parse(weekParam, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) {
        derivedMonday = getWeekStartPT(toZonedTime(parsedDate, APP_TIMEZONE));
      } else {
        derivedMonday = getWeekStartPT(); // Fallback to current week
      }
    } else {
      derivedMonday = getWeekStartPT(); // Default to current week
    }

    const canonicalUrlParam = formatInTimeZone(derivedMonday, APP_TIMEZONE, 'yyyy-MM-dd');

    if (weekStart.getTime() !== derivedMonday.getTime()) {
      setWeekStart(derivedMonday);
    }

    if (weekParam !== canonicalUrlParam) {
      router.push(`/schedule/${locationSlug}?week=${canonicalUrlParam}`, { scroll: false });
    }
  }, [searchParams, locationSlug, router, weekStart]);

  useEffect(() => {
    const currentWeekMondayPT = getWeekStartPT();
    setIsPastWeek(weekStart.getTime() < currentWeekMondayPT.getTime());
  }, [weekStart]);

  const handlePrevWeek = () => {
    const prevWeekDate = subDays(weekStart, 7);
    const formattedDate = formatInTimeZone(prevWeekDate, APP_TIMEZONE, 'yyyy-MM-dd');
    router.push(`/schedule/${locationSlug}?week=${formattedDate}`, { scroll: false });
  };

  const handleNextWeek = () => {
    const nextWeekDate = addDays(weekStart, 7);
    const formattedDate = formatInTimeZone(nextWeekDate, APP_TIMEZONE, 'yyyy-MM-dd');
    router.push(`/schedule/${locationSlug}?week=${formattedDate}`, { scroll: false });
  };

  const handleGenerateSchedule = async () => {
    if (!data?.location) return;

    if (data.scheduledShifts.length > 0) {
      setShowOverwriteDialog(true);
      return;
    }
    await proceedGenerateSchedule(data.location.id, data.location.name);
  };

  const proceedGenerateSchedule = async (locationId: string, locationName: string) => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let managerWorkerId: string | undefined = undefined;

      if (user) {
        const { data: workerData } = await supabase.from('workers').select('id').eq('user_id', user.id).single();
        if (workerData) managerWorkerId = workerData.id;
      }

      await generateWeeklySchedule(supabase, locationId, weekStart, managerWorkerId);

      mutate();

      const formattedWeekStart = formatInTimeZone(weekStart, APP_TIMEZONE, 'MMMM d, yyyy');
      showSuccessToast(`Schedule for ${formatLocationName(locationName)} (week of ${formattedWeekStart}) generated successfully.`);
    } catch (error) {
      console.error("Error during schedule generation process:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) { setIsModalOpen(false); setSelectedShiftModalContext(null); }
  };

  const handleShiftClick = (context: ShiftClickContext) => {
    if (editMode && !isPastWeek) { setSelectedShiftModalContext(context); setIsModalOpen(true); }
  };

  const handleModalClose = () => { setIsModalOpen(false); setSelectedShiftModalContext(null); };

  const handleModalSaveSuccess = async () => {
    setIsModalOpen(false);
    setSelectedShiftModalContext(null);
    await mutate();
  };

  const currentShiftTemplates = data ? data.allShiftTemplates.filter(t => t.location_id === data.location?.id) : [];

  const editButtonDisabled = isPastWeek || isGenerating || !data?.location || isLoading;
  const generateButtonDisabled = isGenerating || editMode || isPastWeek || !data?.location || isLoading;

  const pastWeekTooltipContent = "Past schedules cannot be edited or regenerated.";

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-xl text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto mt-16 px-6 pt-4 pb-8">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-2xl 2xl:text-3xl font-manrope font-bold text-primary-foreground whitespace-nowrap truncate">
            {data?.location && !isLoading ? formatLocationName(data.location.name) : (isLoading ? "Loading Location..." : "Location Not Found")}
          </h1>
          <div className="relative top-[3px]">
            <WeekNavigator weekStart={weekStart} onPrev={handlePrevWeek} onNext={handleNextWeek} isLoading={isLoading} />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <ButtonWrapper isDisabled={editButtonDisabled} showTooltip={isPastWeek && editButtonDisabled} tooltipText={pastWeekTooltipContent}>
            <Button onClick={handleToggleEditMode} variant="outline" className="h-8 text-[13px] 2xl:h-9 2xl:text-sm" disabled={editButtonDisabled} >
              {editMode ? 'View Mode' : 'Edit Schedule'}
            </Button>
          </ButtonWrapper>
          <ButtonWrapper isDisabled={generateButtonDisabled} showTooltip={isPastWeek && generateButtonDisabled} tooltipText={pastWeekTooltipContent}>
            <Button onClick={handleGenerateSchedule} disabled={generateButtonDisabled} className="relative h-8 text-[13px] 2xl:h-9 2xl:text-sm">
              {isGenerating && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                  <span className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
                </span>
              )}
              Generate New Schedule
            </Button>
          </ButtonWrapper>
        </div>
      </div>

      {isLoading ? (
        <ScheduleGridSkeleton />
      ) : !data?.location ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-destructive">Location "{formatLocationName(locationSlug || 'unknown')}" not found.</p>
        </div>
      ) : (
        <>
          <ScheduleGrid
            weekStart={weekStart}
            scheduledShifts={data.scheduledShifts}
            shiftTemplates={currentShiftTemplates}
            workers={data.workers}
            positions={data.positions}
            editMode={editMode}
            onShiftClick={handleShiftClick}
            locationId={data.location?.id}
          />
          {isModalOpen && selectedShiftModalContext && (
            <EditShiftModal
              isOpen={isModalOpen}
              onClose={handleModalClose}
              shiftContext={selectedShiftModalContext}
              onShiftUpdated={handleModalSaveSuccess}
            />
          )}
        </>
      )}

      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite Existing Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              A schedule already exists for this week. Do you want to overwrite it? <br /> This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowOverwriteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowOverwriteDialog(false);
                if (data && data.location) {
                  await proceedGenerateSchedule(data.location.id, data.location.name);
                }
              }}
            >
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulePage; 