'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { formatLocationName } from '@/lib/utils';
import { MapPin, Users, ArrowRight, Cake, MapPinned, CalendarCheck } from 'lucide-react';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboardData } from '@/hooks/useDashboardData';

interface LocationCardData {
  location_id: string;
  location_name: string;
  workersToday?: string[];
}

export default function Dashboard() {
  const router = useRouter();
  const currentWeek = new Date();

  const {
    locations,
    birthdays,
    staffStats,
    error,
    isLoading,
    birthdaysLoading,
    staffStatsLoading,
  } = useDashboardData();

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
    router.push(`/schedule/${locationName}?week=${format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')}`);
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

  return (
    <div className="min-h-screen p-8 mt-16 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-charcoalcocoa">Shift Dashboard</h1>
        </div>
        <div className="mb-8 flex gap-x-8 gap-y-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-bold text-charcoalcocoa">
              Today: {format(new Date(), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-lavendercream" />
            <span className="font-medium text-muted-foreground">
              Current Week: {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {locations.map((locationData: LocationCardData) => {
              const maxVisibleWorkers = 8;
              const workers = locationData.workersToday || [];
              const visibleWorkers = workers.slice(0, maxVisibleWorkers);
              const extraCount = workers.length - maxVisibleWorkers;
              return (

                /* Location cards */
                <div key={locationData.location_id} className="bg-white/90 rounded-lg shadow-sm p-6 border-[2.25px] border-input flex flex-col h-full">
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-xl border-input border-2 flex items-center justify-center mr-4 mt-1">
                      <MapPin className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex flex-col justify-start flex-1">
                      <h2 className="text-lg font-semibold mb-[1.5px] mt-[1px]">
                        {formatLocationName(locationData.location_name)}
                      </h2>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-ashmocha" />
                        <span className="text-sm text-ashmocha">{workers.length} workers</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-[12px]">
                    <p className="text-sm font-normal mb-2">Scheduled Workers:</p>
                    <div className="flex flex-wrap gap-2">
                      {visibleWorkers.map((workerName: string) => {
                        return (
                          <span key={workerName} className="px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-sm font-normal">
                            {workerName}
                          </span>
                        );
                      })}
                      {extraCount > 0 && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-sm font-medium hover:bg-secondary/80 cursor-default focus-visible:outline-none focus-visible:bg-secondary/80">
                                +{extraCount} more
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="start" className="bg-[#E6E1F2] text-charcoalcocoa text-sm font-normal rounded-full">

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
                      className="w-full flex items-center justify-center gap-2 text-base font-semibold py-4 rounded-lg bg-roseblush hover:bg-roseblush/80 transition-all"
                      variant="default"
                      size="lg"
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
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-1 text-charcoalcocoa">This week at a glance</h2>
            <p className="text-base font-medium text-ashmocha">Key insights for your locations</p>
            <div className="grid grid-cols-2 gap-8 mt-2 items-stretch">

              {/* Birthday section */}
              <div className="bg-white/90 rounded-xl p-6 border-[2.25px] border-input shadow-md h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-roseblush/80 rounded-lg flex items-center justify-center">
                    <Cake className="w-6 h-6 text-white" />
                  </div>
                  <div className="">
                    <h3 className="font-semibold text-charcoalcocoa">Birthdays</h3>
                    <p className="text-sm text-charcoalcocoa">
                      {birthdaysLoading ? 'Loading...' :
                        !birthdays || birthdays.length === 0 ? '0 this week' : `${birthdays.length} this week`}
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
                          ({worker.birthday ? `${format(new Date(worker.birthday), 'MM/dd')}` : ''})
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
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#AFCBBF] rounded-lg flex items-center justify-center">
                      <MapPinned className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-charcoalcocoa">Staffing by Location</h3>
                      <p className="text-sm text-charcoalcocoa">Weekly schedule overview</p>
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
                          <span className="font-semibold text-charcoalcocoa">{formatLocationName(stat.locationName)}</span>
                          <div className="flex justify-center">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center text-sm text-ashmocha cursor-pointer hover:underline hover:underline-offset-2 hover:font-bold focus-visible:outline-none focus-visible:underline focus-visible:font-bold transition-all">
                                    [{stat.percentFilled}%]
                                    <CalendarCheck className="w-[14px] h-[14px] ml-1" />
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
                                  <span className="flex items-center text-sm text-ashmocha cursor-pointer hover:underline hover:underline-offset-2 hover:font-bold focus-visible:outline-none focus-visible:underline focus-visible:font-bold transition-all">
                                    [{stat.uniqueScheduled}/{stat.activeWorkers}]
                                    <Users className="w-[14px] h-[14px] ml-1" />
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