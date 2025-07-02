'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { startOfWeek, endOfWeek, format as formatDate } from 'date-fns';
import { Button } from "@/components/ui/button";
import { formatLocationName } from '@/lib/utils';
import { MapPin, Users, ArrowRight, Cake, MapPinned, CalendarCheck } from 'lucide-react';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useScreenSize } from '@/hooks/useScreenSize';
import { toZonedTime, formatInTimeZone, toDate } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/time';

interface LocationCardData {
  location_id: string;
  location_name: string;
  workersToday?: string[];
}

export default function Dashboard() {
  const router = useRouter();
  const currentWeek = toZonedTime(new Date(), APP_TIMEZONE);

  const {
    locations,
    birthdays,
    staffStats,
    error,
    isLoading,
    birthdaysLoading,
    staffStatsLoading,
  } = useDashboardData();

  const screenSize = useScreenSize();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);


  const handleViewSchedule = (locationName: string) => {
    router.push(`/schedule/${locationName}?week=${formatDate(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')}`);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-2xl w-full p-8 bg-card rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4 text-errorred">Error Loading Dashboard</h1>
          <p>There was an issue fetching the dashboard data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const locationStatsMap = staffStats
    ? new Map(staffStats.map((stat: any) => [stat.locationId, stat]))
    : new Map();

  return (
    <div className="min-h-screen p-8 mt-16 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl 2xl:text-3xl font-bold text-charcoalcocoa">Shift Dashboard</h1>
        </div>
        <div className="mb-8 flex gap-x-8 gap-y-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm 2xl:text-base font-bold text-charcoalcocoa">
              Today: {formatInTimeZone(new Date(), APP_TIMEZONE, 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-lavendercream" />
            <span className="text-sm 2xl:text-base font-medium text-muted-foreground">
              Current Week: {formatDate(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d')} - {formatDate(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : !locations || locations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No locations found.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 lg:gap-6 2xl:gap-8">
            {locations.map((locationData: LocationCardData) => {
              let maxVisibleWorkers = 6;
              if (screenSize === '2xl') {
                maxVisibleWorkers = 8;
              }
              const workers = locationData.workersToday || [];
              const visibleWorkers = workers.slice(0, maxVisibleWorkers);
              const extraCount = workers.length - maxVisibleWorkers;
              return (

                /* Location cards */
                <div key={locationData.location_id} className="bg-white/90 rounded-lg shadow-sm p-6 border-[2.25px] border-input flex flex-col h-full">
                  <div className="flex items-start">
                    <div className="w-10 h-10 2xl:w-12 2xl:h-12 rounded-xl border-input border-2 flex items-center justify-center mr-4 mt-1">
                      <MapPin className="w-5 h-5 2xl:w-6 2xl:h-6 text-accent" />
                    </div>
                    <div className="flex flex-col justify-start flex-1">
                      <h2 className="lg:text-base 2xl:text-lg font-semibold mb-[1.5px] mt-[1px]">
                        {formatLocationName(locationData.location_name)}
                      </h2>
                      <div className="flex items-center gap-1 2xl:gap-2 mb-2">
                        <Users className="w-3 h-3 2xl:w-4 2xl:h-4 text-ashmocha" />
                        <span className="text-[11px] 2xl:text-xs text-ashmocha">{workers.length} workers</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-[12px]">
                    <p className="text-xs 2xl:text-sm font-normal mb-2">Scheduled Workers:</p>
                    <div className="flex flex-wrap gap-2">
                      {visibleWorkers.map((workerName: string) => {
                        return (
                          <span key={workerName} className="px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-xs 2xl:text-sm font-normal">
                            {workerName}
                          </span>
                        );
                      })}
                      {extraCount > 0 && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-xs 2xl:text-sm font-medium hover:bg-secondary/80 cursor-default focus-visible:outline-none focus-visible:bg-secondary/80">
                                +{extraCount} more
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="start" className="bg-[#E6E1F2] text-charcoalcocoa text-xs 2xl:text-sm font-normal rounded-full">
                              {workers.slice(maxVisibleWorkers).join(', ')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <div className="mt-8">
                    <Button
                      onClick={() => handleViewSchedule(locationData.location_name)}
                      className="w-full h-9 2xl:h-10 flex items-center justify-center gap-2 lg:text-sm 2xl:text-base font-semibold py-4 rounded-lg bg-roseblush hover:bg-roseblush/80 transition-all"
                      variant="default"
                    >
                      View Schedule
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* This week at a glance section */}
        {!isLoading && locations && locations.length > 0 ? (
          <section className="mt-12 2xl:mt-16">
            <h2 className="text-lg 2xl:text-xl font-bold mb-1 text-charcoalcocoa">This week at a glance</h2>
            <p className="text-sm 2xl:text-base font-medium text-ashmocha">Key insights for your locations</p>
            <div className="grid grid-cols-2 gap-6 2xl:gap-8 mt-2 items-stretch">

              {/* Birthday section */}
              <div className="bg-white/90 rounded-xl p-6 border-[2.25px] border-input shadow-md h-full flex flex-col">
                <div className="flex items-center gap-2 2xl:gap-3 mb-4">
                  <div className="hidden 2xl:flex w-12 h-12 bg-roseblush/80 rounded-md 2xl:rounded-lg items-center justify-center">
                    <Cake className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm text-deeproseblush 2xl:text-base font-semibold 2xl:text-charcoalcocoa">
                      {screenSize === '2xl' ? 'Birthdays' : (screenSize === 'lg' || screenSize === 'xl' ? '🎂Birthdays' : 'Birthdays')}
                    </h3>
                    <p className="text-xs 2xl:text-sm text-charcoalcocoa">
                      {birthdaysLoading ? 'Loading...' :
                        (!birthdays || birthdays.length === 0 ? (
                          <>
                            0 this week
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{birthdays.length}</span> this week
                          </>
                        ))}
                    </p>
                    <p className="text-xs text-ashmocha mt-[2px]">
                      {!birthdays || birthdays.length === 0 ? 'No candles to blow out this week...' : 'Remember to wish them a happy birthday!'}
                    </p>
                  </div>
                </div>

                <ul
                  className={
                    !birthdaysLoading && (!birthdays || birthdays.length === 0)
                      ? "flex flex-col justify-center items-center h-full min-h-[100px] space-y-2"
                      : "space-y-2"
                  }
                >
                  {!birthdaysLoading && birthdays && birthdays.length > 0 ? (
                    birthdays.map((worker: any) => (
                      <li key={worker.id} className="flex items-center justify-between pt-1">
                        <span className="font-semibold text-sm text-charcoalcocoa">
                          {worker.preferred_name || worker.first_name} {worker.last_name}
                        </span>
                        <span className="text-sm text-deeproseblush">
                          {worker.isToday ? 'today' : worker.dayOfWeek}
                          {' '}
                          ({worker.birthday ? `${formatInTimeZone(toDate(worker.birthday, { timeZone: 'UTC' }), APP_TIMEZONE, 'MM/dd')}` : ''})
                        </span>
                      </li>
                    ))
                  ) : (
                    !birthdaysLoading && (
                      <li className="text-muted-foreground text-sm text-center">
                        Nothing to celebrate? Celebrate yourself ✨
                      </li>
                    )
                  )}
                </ul>
              </div>

              {/* Staff stats by location */}
              <div className="h-full flex flex-col">
                <div className="bg-white/90 rounded-xl p-6 border-[2.25px] border-input shadow-md h-full flex flex-col">
                  <div className="flex items-center gap-2 2xl:gap-3 mb-4">
                    <div className="hidden 2xl:flex w-12 h-12 bg-[#AFCBBF] rounded-md 2xl:rounded-lg items-center justify-center">
                      <MapPinned className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm 2xl:text-base font-semibold text-[#4F7A63] 2xl:text-charcoalcocoa">
                        {screenSize === '2xl' ? 'Staffing by Locations' : (screenSize === 'lg' || screenSize === 'xl' ? '📍Staffing by Locations' : 'Staffing by Locations')}
                      </h3>
                      <p className="text-xs 2xl:text-sm text-charcoalcocoa">Weekly schedule overview</p>
                      <p className="text-xs text-ashmocha mt-[2px]">[shifts: planned/required] [workers: uniquely scheduled/active]</p>
                    </div>
                  </div>

                  {/* Stats by location */}
                  {staffStatsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading staff stats...</div>
                  ) : staffStats && staffStats.length > 0 ? (
                    <div className="flex flex-col gap-y-2 w-full">
                      {staffStats.map((stat: any) => (
                        <div key={stat.locationId} className="grid grid-cols-3 items-center w-full py-1">
                          <span className="text-sm 2xl:text-base font-semibold text-charcoalcocoa">{formatLocationName(stat.locationName)}</span>
                          <div className="flex justify-center">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center text-xs 2xl:text-sm text-ashmocha cursor-pointer hover:underline hover:underline-offset-2 hover:font-bold focus-visible:outline-none focus-visible:underline focus-visible:font-bold transition-all">
                                    [{stat.percentFilled}%]
                                    <CalendarCheck className="w-3 h-3 2xl:w-[14px] 2xl:h-[14px] ml-1" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                  {`${stat.filledShifts} out of ${stat.requiredShifts} planned shifts assigned this week.`}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex justify-end">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center text-xs 2xl:text-sm text-ashmocha cursor-pointer hover:underline hover:underline-offset-2 hover:font-bold focus-visible:outline-none focus-visible:underline focus-visible:font-bold transition-all">
                                    [{stat.uniqueScheduled}/{stat.activeWorkers}]
                                    <Users className="w-3 h-3 2xl:w-[14px] 2xl:h-[14px] ml-1" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="end">
                                  {`${stat.uniqueScheduled} unique workers scheduled this week out of ${stat.activeWorkers} active workers.`}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No staff stats available.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
} 