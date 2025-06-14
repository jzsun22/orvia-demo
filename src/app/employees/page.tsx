'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWorkers } from '@/lib/supabase';
import { supabase } from '@/lib/supabase/client'
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

export default function EmployeesPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<DatabaseWorker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<DatabaseWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployeeInfo, setEditingEmployeeInfo] = useState<Employee | null>(null);
  const [editingWorkSettings, setEditingWorkSettings] = useState<Employee | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<DatabaseWorker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const workersRef = useRef<DatabaseWorker[]>([]);

  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  const loadInitialData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const [fetchedWorkers, locationsData] = await Promise.all([
        fetchWorkers(supabase),
        supabase.from('locations').select('id, name').abortSignal(controller.signal)
      ]);

      if (controller.signal.aborted) return;
      if (locationsData.error) throw locationsData.error;
      
      if (!controller.signal.aborted) {
        setWorkers(fetchedWorkers);
        setFilteredWorkers(fetchedWorkers);
        setAllLocations(locationsData.data || []);
      }
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Failed to load initial data. ' + err.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
            await loadInitialData();
            const { data: managerWorker } = await supabase
              .from('workers')
              .select('id')
              .eq('user_id', session.user.id)
              .single();

            if (managerWorker) {
              setManagerId(managerWorker.id);
            }
        } else {
            // No session, redirect or show error
            setLoading(false);
            setError("User not authenticated. Please log in.");
            setWorkers([]);
            setFilteredWorkers([]);
            setManagerId(null);
        }
      } else if (event === 'SIGNED_OUT') {
          setWorkers([]);
          setFilteredWorkers([]);
          setAllLocations([]);
          setManagerId(null);
          setError(null);
          router.push('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      abortControllerRef.current?.abort();
    };
  }, [loadInitialData, router]);

  useEffect(() => {
    let result = [...workers];

    // Apply search filter
    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      result = result.filter((worker) => {
        const fullName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
        const preferredName = worker.preferred_name?.toLowerCase() || '';
        return fullName.includes(lowercasedQuery) || preferredName.includes(lowercasedQuery);
      });
    }

    // Apply location filter
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

    setFilteredWorkers(result);
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

  if (error) {
    return <div className="min-h-screen p-8 bg-[#f8f9f7] text-center text-red-500">{error}</div>;
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
              <Button variant="outline" className="flex items-center justify-between whitespace-nowrap">
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">Location:</span>
                  <span>
                    {locationFilter.length === 0
                      ? 'All'
                      : locationFilter.length === 1
                      ? formatLocationName(allLocations.find(loc => loc.id === locationFilter[0])?.name || '')
                      : `${locationFilter.length} selected`}
                  </span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allLocations.map((location) => (
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
          onSuccess={() => {
            setShowAddModal(false);
            loadInitialData();
          }}
        />
      )}

      {editingEmployeeInfo && (
        <EditEmployeeInfoModal
          isOpen={true}
          employee={editingEmployeeInfo}
          onClose={() => setEditingEmployeeInfo(null)}
          onSuccess={() => {
            setEditingEmployeeInfo(null);
            loadInitialData();
          }}
        />
      )}

      {editingWorkSettings && (
        <EditWorkSettingsModal
          isOpen={true}
          employee={editingWorkSettings}
          onClose={() => setEditingWorkSettings(null)}
          onSuccess={() => {
            setEditingWorkSettings(null);
            loadInitialData();
          }}
        />
      )}

      {editingAvailability && (
        <AvailabilityModal
          isOpen={true}
          employee={editingAvailability}
          onClose={() => setEditingAvailability(null)}
          onSuccess={() => {
            setEditingAvailability(null);
            loadInitialData();
          }}
        />
      )}
    </div>
  );
} 