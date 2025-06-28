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

const PT_TIMEZONE = 'America/Los_Angeles';

// Helper to get a Date object representing midnight PT for a given PT year, month, day
function getPTMidnightDate(year: number, month: number, day: number): Date {
  const sampleUTCNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const sampleDateObj = new Date(sampleUTCNoon);
  const ptHourAtUTCNoonStr = sampleDateObj.toLocaleTimeString('en-US', {
    timeZone: PT_TIMEZONE,
    hour12: false,
    hour: '2-digit',
  });
  const ptHourAtUTCNoon = parseInt(ptHourAtUTCNoonStr);
  let utcHourForPTMidnight = (12 - ptHourAtUTCNoon + 24) % 24;
  return new Date(Date.UTC(year, month - 1, day, utcHourForPTMidnight, 0, 0));
}

// Helper to get the Date object for Monday 00:00 PT of the week containing referenceDate
function getWeekStartPT(referenceDate: Date): Date {
  const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [refYearPT, refMonthPT, refDayPT] = ptDateFormatter.format(referenceDate).split('-').map(Number);
  let noonOnRefDayPT = getPTMidnightDate(refYearPT, refMonthPT, refDayPT);
  noonOnRefDayPT.setUTCHours(noonOnRefDayPT.getUTCHours() + 12);
  const dayOfWeekStrPT = noonOnRefDayPT.toLocaleDateString('en-US', {
    timeZone: PT_TIMEZONE,
    weekday: 'short',
  });
  const dayMapPT: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeekInPT = dayMapPT[dayOfWeekStrPT] !== undefined ? dayMapPT[dayOfWeekStrPT] : new Date().getDay();
  const daysToSubtract = (dayOfWeekInPT - 1 + 7) % 7;
  const mondayAtNoonPT = new Date(noonOnRefDayPT.getTime());
  mondayAtNoonPT.setUTCDate(mondayAtNoonPT.getUTCDate() - daysToSubtract);
  const [monYearPT, monMonthPT, monDayPT] = ptDateFormatter.format(mondayAtNoonPT).split('-').map(Number);
  return getPTMidnightDate(monYearPT, monMonthPT, monDayPT);
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

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartPT(new Date()));
  const [editMode, setEditMode] = useState(false);
  const [selectedShiftModalContext, setSelectedShiftModalContext] = useState<ShiftClickContext | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPastWeek, setIsPastWeek] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);

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
    const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: PT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    let derivedMondayFromUrl: Date;
    let needsUrlUpdate = false;
    let newUrlWeekParam: string = '';

    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      const [year, month, day] = weekParam.split('-').map(Number);
      const dateFromParamAsPTMidnight = getPTMidnightDate(year, month, day);
      derivedMondayFromUrl = getWeekStartPT(dateFromParamAsPTMidnight);
      const canonicalUrlParamForDerivedDate = ptDateFormatter.format(derivedMondayFromUrl);
      if (weekParam !== canonicalUrlParamForDerivedDate) {
        needsUrlUpdate = true;
        newUrlWeekParam = canonicalUrlParamForDerivedDate;
      } else {
        newUrlWeekParam = weekParam;
      }
    } else {
      derivedMondayFromUrl = getWeekStartPT(new Date());
      needsUrlUpdate = true;
      newUrlWeekParam = ptDateFormatter.format(derivedMondayFromUrl);
    }

    if (weekStart.getTime() !== derivedMondayFromUrl.getTime()) {
      setWeekStart(derivedMondayFromUrl);
    }

    if (needsUrlUpdate && weekParam !== newUrlWeekParam) {
      router.push(`/schedule/${locationSlug}?week=${newUrlWeekParam}`, { scroll: false });
    }
  }, [searchParams, locationSlug, router, weekStart]);

  useEffect(() => {
    const currentWeekMondayPT = getWeekStartPT(new Date());
    setIsPastWeek(weekStart.getTime() < currentWeekMondayPT.getTime());
  }, [weekStart]);

  const handlePrevWeek = () => {
    const currentWS = weekStart;
    const prevWeekDate = new Date(currentWS.getTime());
    prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7);
    const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: PT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const formattedDate = ptDateFormatter.format(prevWeekDate);
    if (locationSlug) {
      router.push(`/schedule/${locationSlug}?week=${formattedDate}`, { scroll: false });
    }
  };

  const handleNextWeek = () => {
    const currentWS = weekStart;
    const nextWeekDate = new Date(currentWS.getTime());
    nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
    const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: PT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const formattedDate = ptDateFormatter.format(nextWeekDate);
    if (locationSlug) {
      router.push(`/schedule/${locationSlug}?week=${formattedDate}`, { scroll: false });
    }
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

      const formattedWeekStart = weekStart.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
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
          <h1 className="text-3xl font-manrope font-bold text-primary-foreground whitespace-nowrap truncate">
            {data?.location && !isLoading ? formatLocationName(data.location.name) : (isLoading ? "Loading Location..." : "Location Not Found")}
          </h1>
          <div className="relative top-[3px]">
            <WeekNavigator weekStart={weekStart} onPrev={handlePrevWeek} onNext={handleNextWeek} isLoading={isLoading} />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <ButtonWrapper isDisabled={editButtonDisabled} showTooltip={isPastWeek && editButtonDisabled} tooltipText={pastWeekTooltipContent}>
            <Button onClick={handleToggleEditMode} variant="outline" disabled={editButtonDisabled} >
              {editMode ? 'View Mode' : 'Edit Schedule'}
            </Button>
          </ButtonWrapper>
          <ButtonWrapper isDisabled={generateButtonDisabled} showTooltip={isPastWeek && generateButtonDisabled} tooltipText={pastWeekTooltipContent}>
            <Button onClick={handleGenerateSchedule} disabled={generateButtonDisabled} className="relative">
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