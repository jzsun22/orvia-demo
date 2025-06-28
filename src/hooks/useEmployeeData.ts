import useSWR from 'swr';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { fetchWorkers } from '@/lib/supabase';
import type { DatabaseWorker, Location, Position } from '@/lib/types';

// A specific fetcher for the manager's worker ID, which depends on the user session.
const managerIdFetcher = async (key: string, userId: string) => {
  if (key !== 'managerId' || !userId) return null;
  const { data, error } = await supabase.from('workers').select('id').eq('user_id', userId).single();
  if (error) {
    console.warn("Could not find a manager worker for the current user.");
    return null;
  }
  return data?.id || null;
};

export function useEmployeeData(session: Session | null) {
  const { data: workers, error: workersError, isLoading: isWorkersLoading, mutate: mutateWorkers } = useSWR<DatabaseWorker[]>('workers', () => fetchWorkers(supabase));
  
  const { data: allLocations, error: locationsError, isLoading: isLocationsLoading } = useSWR<Location[]>('locations', async () => {
    const { data, error } = await supabase.from('locations').select('id, name');
    if (error) throw error;
    return data;
  });

  const { data: allPositions, error: positionsError, isLoading: isPositionsLoading } = useSWR<Position[]>('positions', async () => {
    const { data, error } = await supabase.from('positions').select('id, name');
    if (error) throw error;
    return data;
  });

  const { data: managerId, error: managerError, isLoading: isManagerLoading } = useSWR(
    session?.user ? ['managerId', session.user.id] : null,
    ([key, userId]) => managerIdFetcher(key, userId)
  );

  const loading = isWorkersLoading || isLocationsLoading || isPositionsLoading || (session && isManagerLoading);
  const error = workersError || locationsError || positionsError || managerError;

  return {
    workers,
    mutateWorkers,
    allLocations,
    allPositions,
    managerId,
    loading,
    error,
  };
} 