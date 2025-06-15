'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import { fetchWorkers } from '@/lib/supabase';
import { PlusCircle, Search, ChevronDown } from 'lucide-react';
import { AddEmployeeModal } from '@/components/modals/AddEmployeeModal';
import { EditEmployeeInfoModal } from '@/components/modals/EditEmployeeInfoModal';
import { EditWorkSettingsModal } from '@/components/modals/EditWorkSettingsModal';
import { AvailabilityModal } from '@/components/modals/AvailabilityModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatWorkerName, formatLocationName } from '@/lib/utils';
import { JobLevel, Location } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import EmployeeTableSkeleton from '@/components/employees/EmployeeTableSkeleton';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

interface DatabaseWorker {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  job_level: JobLevel;
  availability: any;
  preferred_hours_per_week: number | null;
  is_lead: boolean;
  created_at: string;
  inactive?: boolean | null;
  gender: 'male' | 'female' | 'non-binary' | null;
  birthday: string | null;
  positions: {
    position: {
      name: string;
      id: string;
    }
  }[];
  locations: {
    location: {
      id: string;
      name: string;
    }
  }[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  job_level: JobLevel;
  is_lead: boolean;
  location_ids: string[];
  positions: string[];
  availability: any;
  preferred_hours_per_week: number | null;
  created_at: string;
  inactive?: boolean | null;
  gender: 'male' | 'female' | 'non-binary' | null;
  birthday: string | null;
}

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

export default function EmployeesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployeeInfo, setEditingEmployeeInfo] = useState<Employee | null>(null);
  const [editingWorkSettings, setEditingWorkSettings] = useState<Employee | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<DatabaseWorker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  
  // SWR hooks for data fetching
  const { data: workers, error: workersError, isLoading: isWorkersLoading, mutate: mutateWorkers } = useSWR<DatabaseWorker[]>('workers', () => fetchWorkers(supabase));
  const { data: allLocations, error: locationsError, isLoading: isLocationsLoading } = useSWR<Location[]>('locations', async () => {
    const { data, error } = await supabase.from('locations').select('id, name');
    if (error) throw error;
    return data;
  });
  const { data: managerId, error: managerError, isLoading: isManagerLoading } = useSWR(
    session?.user ? ['managerId', session.user.id] : null,
    ([key, userId]) => managerIdFetcher(key, userId)
  );
  
  const loading = isWorkersLoading || isLocationsLoading || (session && isManagerLoading);
  const error = workersError || locationsError || managerError;

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    
    let result = [...workers];

    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      result = result.filter((worker) => {
        const fullName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
        const preferredName = worker.preferred_name?.toLowerCase() || '';
        return fullName.includes(lowercasedQuery) || preferredName.includes(lowercasedQuery);
      });
    }

    if (locationFilter.length > 0) {
      result = result.filter(worker => 
        worker.locations.some(loc => locationFilter.includes(loc.location.id))
      );
    }

    result.sort((a, b) => {
      if (managerId) {
        if (a.id === managerId) return -1;
        if (b.id === managerId) return 1;
      }
      const nameA = formatWorkerName(a.first_name, a.last_name, a.preferred_name);
      const nameB = formatWorkerName(b.first_name, b.last_name, b.preferred_name);
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [searchQuery, workers, locationFilter, managerId]);
  
  const handleLocationFilterChange = (locationId: string) => {
    setLocationFilter(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleEditInfoClick = (worker: DatabaseWorker) => {
    const employeeToEdit: Employee = {
      ...worker,
      positions: worker.positions.map(p => p.position.id),
      location_ids: worker.locations.map(l => l.location.id),
      preferred_name: worker.preferred_name || null,
    };
    setEditingEmployeeInfo(employeeToEdit);
  };

  const handleWorkSettingsClick = (worker: DatabaseWorker) => {
    const employeeToEdit: Employee = {
      ...worker,
      positions: worker.positions.map(p => p.position.id),
      location_ids: worker.locations.map(l => l.location.id),
      preferred_name: worker.preferred_name || null,
    };
    setEditingWorkSettings(employeeToEdit);
  };
  
  const handleAvailabilityClick = (worker: DatabaseWorker) => {
    setEditingAvailability(worker);
  };

  const handleModalSuccess = () => {
    setShowAddModal(false);
    setEditingEmployeeInfo(null);
    setEditingWorkSettings(null);
    setEditingAvailability(null);
    mutateWorkers(); // Revalidate the workers data
  };

  if (error) {
    return <div className="min-h-screen p-8 bg-[#f8f9f7] text-center text-red-500">
      Failed to load data. Please try refreshing the page.
    </div>;
  }

  return (
    <div className="min-h-screen p-8 bg-[#f8f9f7]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Employees</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0d5442] rounded-md hover:bg-[#0d5442]/90 transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
            Add Employee
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search employees by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center justify-between whitespace-nowrap" disabled={!allLocations}>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">Location:</span>
                  <span>
                    {locationFilter.length === 0
                      ? 'All'
                      : locationFilter.length === 1
                      ? formatLocationName(allLocations?.find(loc => loc.id === locationFilter[0])?.name || '')
                      : `${locationFilter.length} selected`}
                  </span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allLocations?.map((location) => (
                <DropdownMenuCheckboxItem
                  key={location.id}
                  checked={locationFilter.includes(location.id)}
                  onCheckedChange={() => handleLocationFilterChange(location.id)}
                >
                  {formatLocationName(location.name)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <EmployeeTableSkeleton />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Level</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Positions</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locations</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredWorkers.map((worker) => (
                    <tr key={worker.id}>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatWorkerName(worker.first_name, worker.last_name, worker.preferred_name)}</span>
                          {worker.inactive && (
                            <Badge variant="secondary" className="text-xs font-light">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{worker.job_level}</td>
                      <td className="py-3 px-4">{worker.positions.map(p => p.position.name).join(', ')}</td>
                      <td className="py-3 px-4">
                        {worker.locations.map(l => formatLocationName(l.location.name)).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditInfoClick(worker)}
                            variant="outline"
                            size="sm"
                          >
                            Edit Info
                          </Button>
                          <Button
                            onClick={() => handleWorkSettingsClick(worker)}
                            variant="outline"
                            size="sm"
                          >
                            Edit Settings
                          </Button>
                          <Button
                            onClick={() => handleAvailabilityClick(worker)}
                            variant="outline"
                            size="sm"
                          >
                            Set Availability
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddEmployeeModal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingEmployeeInfo && (
        <EditEmployeeInfoModal
          isOpen={true}
          employee={editingEmployeeInfo}
          onClose={() => setEditingEmployeeInfo(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingWorkSettings && (
        <EditWorkSettingsModal
          isOpen={true}
          employee={editingWorkSettings}
          onClose={() => setEditingWorkSettings(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingAvailability && (
        <AvailabilityModal
          isOpen={true}
          employee={editingAvailability}
          onClose={() => setEditingAvailability(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
} 