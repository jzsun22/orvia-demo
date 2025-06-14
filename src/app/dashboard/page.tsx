'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { fetchAllLocations } from '@/lib/supabase';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { formatLocationName } from '@/lib/utils';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

interface LocationCardData {
  location_id: string;
  location_name: string;
  workersToday?: string[];
}

export default function Dashboard() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = new Date();
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      router.push('/login');
      router.refresh();
    }
  };

  const fetchLocationData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    setError(null);

    try {
      const allLocations = await fetchAllLocations(supabase);
      if (controller.signal.aborted) return;

      if (!allLocations || allLocations.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todaysScheduledData, error: shiftsError } = await supabase
        .from('scheduled_shifts')
        .select(`
          shift_date,
          shift_templates!inner (
            location_id,
            locations!inner (id, name)
          ),
          shift_assignments!inner (
            workers!inner (id, first_name, last_name, preferred_name)
          )
        `)
        .eq('shift_date', today)
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;

      if (shiftsError) {
        console.error("Error fetching today's scheduled shifts:", shiftsError);
        throw shiftsError;
      }

      const workersGroupedByLocation: Record<string, Set<string>> = {};

      if (todaysScheduledData) {
        todaysScheduledData.forEach((shift: any) => {
          if (shift.shift_templates && shift.shift_templates.locations) {
            const locationId = shift.shift_templates.locations.id;
            if (!workersGroupedByLocation[locationId]) {
              workersGroupedByLocation[locationId] = new Set();
            }
            if (Array.isArray(shift.shift_assignments)) {
              shift.shift_assignments.forEach((assignment: any) => {
                if (assignment.workers) {
                  const worker = assignment.workers;
                  const workerName =
                    worker.preferred_name ||
                    `${worker.first_name || ''} ${worker.last_name || ''}`.trim();
                  if (workerName) {
                    workersGroupedByLocation[locationId].add(workerName);
                  }
                }
              });
            }
          }
        });
      }
      
      const locationData: LocationCardData[] = allLocations.map((location) => ({
        location_id: location.id,
        location_name: location.name,
        workersToday: workersGroupedByLocation[location.id] 
          ? Array.from(workersGroupedByLocation[location.id]).sort() 
          : [],
      }));

      setLocations(locationData);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching location data:', err);
        setError('Failed to load dashboard data.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLocationData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLocationData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        await fetchLocationData();
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      authListener.subscription.unsubscribe();
      abortControllerRef.current?.abort();
    };
  }, [fetchLocationData]);

  const handleViewSchedule = (locationName: string) => {
    router.push(`/schedule/${locationName}?week=${format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')}`);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-2xl w-full p-8 bg-card rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error Loading Dashboard</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-[#f8f9f7]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-[#1f1f1f]">Shift Dashboard</h1>
          <div className="flex gap-4 items-center">
            <Button onClick={handleLogout} variant="outline" size="sm">Logout</Button>
          </div>
        </div>
        <div className="mb-8 flex gap-x-8 gap-y-4 items-center">
            <span className="font-bold text-[#1f1f1f]">
              Today: {format(new Date(), 'MMM d, yyyy')}
            </span>
            <span className="font-medium text-muted-foreground">
              Current Week: {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
            </span>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : locations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No locations found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((locationData) => (
              <div key={locationData.location_id} className="bg-card rounded-lg shadow-md p-6 border border-border flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f1f1f] mb-2">{formatLocationName(locationData.location_name)}</h2>
                  {locationData.workersToday && locationData.workersToday.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-1">Working today:</p>
                      <ul className="list-disc list-inside text-sm text-[#4d4d4d] mb-4">
                        {locationData.workersToday.map(workerName => (
                          <li key={workerName}>{workerName}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">No workers scheduled for today.</p>
                  )}
                </div>
                <div className="flex gap-3 mt-auto">
                  <Button
                    onClick={() => handleViewSchedule(locationData.location_name)}
                    className="flex-1"
                    variant="default"
                    size="sm"
                  >
                    View Schedule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 