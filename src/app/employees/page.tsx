'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PlusCircle, Search, ChevronDown, User, Briefcase, Contact, Calendar } from 'lucide-react';
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatWorkerName, formatLocationName, cn } from '@/lib/utils';
import { DatabaseWorker, Employee, JobLevel, Location, Position } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import EmployeeTableSkeleton from '@/components/employees/EmployeeTableSkeleton';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { useEmployeeData } from '@/hooks/useEmployeeData';

export default function EmployeesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployeeInfo, setEditingEmployeeInfo] = useState<Employee | null>(null);
  const [editingWorkSettings, setEditingWorkSettings] = useState<Employee | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<DatabaseWorker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  // SWR hooks for data fetching moved to custom hook
  const { workers, mutateWorkers, allLocations, allPositions, managerId, loading, error } = useEmployeeData(session);

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

    if (roleFilter.length > 0) {
      result = result.filter(worker =>
        worker.positions.some(p => roleFilter.includes(p.position.id))
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
  }, [searchQuery, workers, locationFilter, roleFilter, managerId]);

  const sortedPositions = useMemo(() => {
    if (!allPositions) return [];
    const desiredOrder = ['Barista', 'Front desk', 'Kitchen - prep', 'Kitchen - fruit', 'Prep + Barista'];
    const positionsCopy = [...allPositions];

    positionsCopy.sort((a, b) => {
      const indexA = desiredOrder.indexOf(a.name);
      const indexB = desiredOrder.indexOf(b.name);
      const effectiveIndexA = indexA === -1 ? Infinity : indexA;
      const effectiveIndexB = indexB === -1 ? Infinity : indexB;

      if (effectiveIndexA !== effectiveIndexB) {
        return effectiveIndexA - effectiveIndexB;
      }
      return a.name.localeCompare(b.name);
    });

    return positionsCopy;
  }, [allPositions]);

  const handleLocationFilterChange = (locationId: string) => {
    setLocationFilter(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleRoleFilterChange = (positionId: string) => {
    setRoleFilter(prev =>
      prev.includes(positionId)
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
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
    return <div className="min-h-screen p-8 bg-white text-center text-errorred">
      Failed to load data. Please try refreshing the page.
    </div>;
  }

  return (
    <div className="min-h-screen p-8 mt-16 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold">Employees</h1>
              {!loading && (
                <span className="text-gray-500">
                  ({filteredWorkers.length} shown)
                </span>
              )}
            </div>
            <p className="text-ashmocha text-base pt-2">View, manage, and update team members.</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search employees by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
                disabled={!!loading}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="flex items-center justify-between border-2 !border-input whitespace-nowrap bg-white hover:ring-1 hover:ring-roseblush hover:bg-white data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:border-1 data-[state=open]:ring-offset-2 shadow-sm rounded-md transition-all"
                  disabled={!allLocations}>
                  <div className="flex items-center text-muted-foreground font-normal">
                    <span className="mr-1">Location:</span>
                    <span>
                      {locationFilter.length === 0
                        ? 'All'
                        : locationFilter.length === 1
                          ? formatLocationName(allLocations?.find(loc => loc.id === locationFilter[0])?.name || '')
                          : `${locationFilter.length} selected`}
                    </span>
                  </div>
                  <ChevronDown className="ml-4 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-1 -ml-1">
                <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allLocations?.map((location) => (
                  <DropdownMenuCheckboxItem
                    key={location.id}
                    checked={locationFilter.includes(location.id)}
                    onCheckedChange={() => handleLocationFilterChange(location.id)}
                    className="hover:bg-accent/50 focus:bg-accent/50"
                  >
                    {formatLocationName(location.name)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="flex items-center justify-between border-2 !border-input whitespace-nowrap bg-white hover:ring-1 hover:ring-roseblush hover:bg-white data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:border-1 data-[state=open]:ring-offset-2 shadow-sm rounded-md transition-all"
                  disabled={!allPositions}>
                  <div className="flex items-center text-muted-foreground font-normal">
                    <span className="mr-1">Role:</span>
                    <span>
                      {roleFilter.length === 0
                        ? 'All'
                        : roleFilter.length === 1
                          ? allPositions?.find(pos => pos.id === roleFilter[0])?.name || ''
                          : `${roleFilter.length} selected`}
                    </span>
                  </div>
                  <ChevronDown className="ml-4 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-1 -ml-1">
                <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortedPositions.map((position) => (
                  <DropdownMenuCheckboxItem
                    key={position.id}
                    checked={roleFilter.includes(position.id)}
                    onCheckedChange={() => handleRoleFilterChange(position.id)}
                    className="hover:bg-accent/50 focus:bg-accent/50"
                  >
                    {position.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className={cn("flex items-center gap-2 px-4 h-11 py-2 bg-deeproseblush text-white text-sm font-semibold rounded-lg hover:bg-deeproseblush/90 transition-all duration-200 hover:shadow-sm", { "opacity-50 cursur-not-allowed pointer-events-none": loading, })}
            disabled={!!loading}
          >
            <PlusCircle className="h-5 w-5" />
            Add Employee
          </button>
        </div>

        {/* Employee Table */}
        {loading ? (
          <EmployeeTableSkeleton />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-oatbeige/60">
                  <tr>
                    <th scope="col" className="py-4 pl-8 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider">Name</th>
                    <th scope="col" className="py-4 px-0 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider">Role</th>
                    <th scope="col" className="py-4 px-2 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider">Locations</th>
                    <th scope="col" className="py-4 pr-6 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredWorkers.map((worker) => (
                    <tr key={worker.id} className="odd:bg-almondmilk/30 even:bg-white">
                      <td className="py-6 pl-8 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatWorkerName(worker.first_name, worker.last_name, worker.preferred_name)}</span>
                          <>
                          {worker.is_lead && (
                            <Badge variant="secondary" className="bg-pistachiomist/60 hover:bg-pistachiomist text-[10px] font-medium">
                              Lead
                            </Badge>
                          )}
                          {worker.inactive && (
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              Inactive
                            </Badge>
                          )}
                          </>
                        </div>
                      </td>
                      <td className="py-6 px-0 text-sm">{`${worker.job_level} - ${worker.positions.map(p => p.position.name).join(', ')}`}</td>
                      <td className="py-6 px-2 text-sm">
                        {worker.locations.map(l => formatLocationName(l.location.name)).join(', ')}
                      </td>
                      <td className="py-6 pr-6 text-sm">
                        <div className="flex gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="sm" className="flex items-center gap-2 data-[state=open]:ring-1 data-[state=open]:ring-[#C8BEDF] focus-visible:ring-0 focus-visible:ring-offset-0">
                                <User className="h-4 w-4" />
                                Edit
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className='border-[#C8BEDF]'>
                              <DropdownMenuItem onClick={() => handleEditInfoClick(worker)} className="flex items-center gap-2 pr-4 cursor-pointer focus:bg-lavendercream">
                                <Contact className="h-4 w-4" />
                                Personal Info
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWorkSettingsClick(worker)} className="flex items-center gap-2 pr-4 cursor-pointer focus:bg-lavendercream">
                                <Briefcase className="h-4 w-4" />
                                Job Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button
                            onClick={() => handleAvailabilityClick(worker)}
                            variant="secondary"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Calendar className="h-4 w-4" />
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