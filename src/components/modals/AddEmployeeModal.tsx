'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { employeeSchema, type EmployeeFormData } from '@/lib/schemas/employee';
import { supabase } from '@/lib/supabase/client';
import { fetchAllLocations } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Location, JobLevel, Position } from '@/lib/types';
import { useAppToast } from "@/lib/toast-service";
import { formatLocationName, cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// Define a type for the shape returned by the Supabase query
interface FetchedLocationPosition {
  id: string;
  location_id: string;
  position: Position; // Nested position object
}

const AddEmployeeFormSkeleton = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-9 w-full" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2 2xl:gap-4">
            <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-full" />
            </div>
        </div>
        <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-2">
                <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        </div>
        <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-3/4 mt-2" />
        </div>
        <Separator className="my-0" />
        <Skeleton className="h-10 w-full" />
        <div className="flex justify-end gap-2 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-36" />
        </div>
    </div>
);

const JOB_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const { showSuccessToast } = useAppToast();
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allLocationPositions, setAllLocationPositions] = useState<FetchedLocationPosition[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<EmployeeFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      preferred_name: '',
      job_level: 'L1',
      is_lead: false,
      positions: [],
      location_ids: [],
      preferred_hours_per_week: undefined,
      inactive: false,
    }
  });

  // Fetch initial data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch all locations
        const locations = await fetchAllLocations(supabase as any);
        setAllLocations(locations);

        // 2. Fetch all location-position mappings with position details
        const { data: locationPositionsData, error: lpError } = await supabase
          .from('location_positions')
          .select(`
            id,
            location_id,
            position:positions (
              id,
              name
            )
          `);

        if (lpError) throw lpError;

        // Map the potentially nested array structure from Supabase
        const fetchedData: FetchedLocationPosition[] = (locationPositionsData || []).map((item: any) => {
          // If item.position is an array, take the first element, otherwise use it directly
          const positionObject = Array.isArray(item.position) ? item.position[0] : item.position;
          return {
            id: item.id,
            location_id: item.location_id,
            // Ensure positionObject is a valid Position before assigning
            position: positionObject && typeof positionObject === 'object' && 'id' in positionObject && 'name' in positionObject
              ? positionObject
              : { id: '', name: 'Unknown' } // Fallback or handle error appropriately
          };
        }).filter(lp => lp.position.id !== ''); // Filter out any malformed entries

        setAllLocationPositions(fetchedData);

        // 3. Extract unique positions from all mappings
        const uniquePositions = fetchedData
          .map(lp => lp.position) // Now lp.position should be a valid Position object
          .filter((pos, index, self) =>
            pos && index === self.findIndex(p => p?.id === pos.id)
          );
        setAllPositions(uniquePositions);

      } catch (err: any) {
        console.error('Error fetching initial modal data:', err);
        setError('Failed to load required data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  // Watch locations to filter positions
  const watchLocationIds = watch('location_ids');
  useEffect(() => {
    if (watchLocationIds && watchLocationIds.length > 0) {
      // Filter the fetched mappings based on selected location IDs
      const relevantMappings = allLocationPositions.filter(lp =>
        watchLocationIds.includes(lp.location_id) // Use location_id
      );

      // Get unique positions available in the selected locations
      const positionsInSelectedLocations = relevantMappings
        .map(lp => lp.position) // Extract the position object
        .filter((pos, index, self) =>
          pos && index === self.findIndex(p => p?.id === pos.id) // Ensure uniqueness
        );

      setFilteredPositions(positionsInSelectedLocations);
      // Clear selected positions if they are no longer valid for the new location selection
      const currentSelectedPositions = watch('positions');
      const validSelectedPositions = currentSelectedPositions.filter(posId =>
        positionsInSelectedLocations.some(p => p.id === posId)
      );
      setValue('positions', validSelectedPositions);

    } else {
      setFilteredPositions([]);
      setValue('positions', []);
    }
  }, [watchLocationIds, allLocationPositions, setValue, watch]);

  const onSubmit = async (data: EmployeeFormData) => {
    setLoading(true);
    setError(null);

    try {
      // Insert new worker
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .insert([{
          first_name: data.first_name,
          last_name: data.last_name,
          preferred_name: data.preferred_name || null,
          job_level: data.job_level,
          is_lead: data.is_lead,
          // Initialize availability and preferred hours, adjust if needed
          availability: {},
          preferred_hours_per_week: data.preferred_hours_per_week ?? null,
          inactive: data.inactive
        }] as any)
        .select()
        .single();

      if (workerError) throw workerError;
      if (!worker) throw new Error("Worker creation failed.");

      // Insert worker positions
      if (data.positions.length > 0) {
        const workerPositions = data.positions.map(positionId => ({
          worker_id: (worker as any)?.id,
          position_id: positionId
        }));

        const { error: positionsError } = await supabase
          .from('worker_positions')
          .insert(workerPositions as any);

        if (positionsError) throw positionsError;
      }

      // Insert worker locations
      if (data.location_ids && data.location_ids.length > 0) { // Check if location_ids exists
        const workerLocations = data.location_ids.map(locationId => ({
          worker_id: (worker as any)?.id,
          location_id: locationId
        }));

        const { error: locationsError } = await supabase
          .from('worker_locations')
          .insert(workerLocations as any);

        if (locationsError) throw locationsError;
      }

      showSuccessToast(`Welcome aboard! Employee added successfully.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error adding employee:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  // Intercept submit to show confirmation dialog
  const handleFormSubmit = (data: EmployeeFormData) => {
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-background p-0 border-[1.5px] border-verylightbeige">
        <ScrollArea className="max-h-[380px] xl:max-h-[600px] 2xl:max-h-full">
          <div className="p-8 xl:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg 2xl:text-xl font-manrope font-medium mb-4">Add New Employee</DialogTitle>
            </DialogHeader>

            {loading ? (
              <AddEmployeeFormSkeleton />
            ) : (
              <>
                {error && <p className="text-sm text-errorred text-center mb-4">Error: {error}</p>}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-xs 2xl:text-sm">First Name</Label>
                      <Input
                        id="first_name"
                        {...register('first_name')}
                        placeholder="Enter first name"
                        className={cn("border border-input bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none", errors.first_name ? 'border-errorred' : '')}
                      />
                      {errors.first_name && (
                        <p className="text-sm text-errorred">{errors.first_name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-xs 2xl:text-sm">Last Name</Label>
                      <Input
                        id="last_name"
                        {...register('last_name')}
                        placeholder="Enter last name"
                        className={cn("border border-input bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none", errors.last_name ? 'border-errorred' : '')}
                      />
                      {errors.last_name && (
                        <p className="text-sm text-errorred">{errors.last_name.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 2xl:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="preferred_name" className="text-xs 2xl:text-sm">Preferred Name (Optional)</Label>
                      <Input
                        id="preferred_name"
                        {...register('preferred_name')}
                        placeholder="Enter preferred name"
                        className="border border-input bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs 2xl:text-sm">Locations</Label>
                    {allLocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No locations available.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {allLocations.map((location: Location) => (
                          <div key={location.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`location-${location.id}`}
                              value={location.id}
                              checked={watchLocationIds?.includes(location.id)}
                              onCheckedChange={(checked) => {
                                const currentLocations = watchLocationIds || [];
                                const newLocations = checked
                                  ? [...currentLocations, location.id]
                                  : currentLocations.filter((id) => id !== location.id);
                                setValue('location_ids', newLocations, { shouldValidate: true });
                              }}
                            />
                            <Label htmlFor={`location-${location.id}`} className="font-normal text-xs 2xl:text-sm">
                              {formatLocationName(location.name)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    {errors.location_ids && (
                      <p className="text-sm text-errorred">{errors.location_ids.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs 2xl:text-sm">Positions</Label>
                    {watchLocationIds?.length > 0 ? (
                      filteredPositions.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {filteredPositions.map((position: Position) => (
                            <div key={position.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`position-${position.id}`}
                                value={position.id}
                                checked={watch('positions')?.includes(position.id)}
                                onCheckedChange={(checked) => {
                                  const currentPositions = watch('positions') || [];
                                  const newPositions = checked
                                    ? [...currentPositions, position.id]
                                    : currentPositions.filter((id) => id !== position.id);
                                  setValue('positions', newPositions, { shouldValidate: true });
                                }}
                              />
                              <Label htmlFor={`position-${position.id}`} className="font-normal text-xs 2xl:text-sm">
                                {position.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] 2xl:text-sm text-muted-foreground">No positions available for the selected location(s).</p>
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground">Select at least one location to see available positions.</p>
                    )}
                    {errors.positions && (
                      <p className="text-sm text-errorred">{errors.positions.message}</p>
                    )}
                  </div>

                  <Separator className="my-0 bg-verylightbeige" />

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-b-0">
                      <AccordionTrigger className="text-base 2xl:text-lg font-medium text-ashmocha pt-0 pb-4">Advanced Job Configurations</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="preferred_hours_per_week" className="text-xs 2xl:text-sm">Preferred hours per week</Label>
                            <Input
                              id="preferred_hours_per_week"
                              type="number"
                              min="0"
                              max="40"
                              placeholder="optional"
                              {...register('preferred_hours_per_week')}
                              className={cn("border border-input bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none", errors.preferred_hours_per_week ? 'border-errorred' : '')}
                            />
                          </div>


                          <div className="space-y-2">
                            <Label htmlFor="job_level" className="text-xs 2xl:text-sm">Job Level</Label>
                            <Select
                              onValueChange={(value) => {
                                if (JOB_LEVELS.includes(value as JobLevel)) {
                                  setValue('job_level', value as JobLevel);
                                }
                              }}
                              defaultValue="L1"
                            >
                              <SelectTrigger className={errors.job_level ? 'border-errorred' : ''}>
                                <SelectValue placeholder="Select a job level" />
                              </SelectTrigger>
                              <SelectContent>
                                {JOB_LEVELS.map((level) => (
                                  <SelectItem key={level} value={level}>
                                    {level}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.job_level && (
                              <p className="text-sm text-errorred">{errors.job_level.message}</p>
                            )}
                          </div>
                        </div>


                        <div className="flex items-center space-x-2 pt-8 mb-2">
                          <Checkbox
                            id="is_lead"
                            checked={watch('is_lead')}
                            onCheckedChange={(checked) => setValue('is_lead', checked as boolean)}
                          />
                          <Label htmlFor="is_lead" className="text-xs 2xl:text-sm font-normal">
                            Can be assigned as Opening/Closing Lead
                          </Label>
                        </div>

                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <DialogFooter className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Employee'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </div>
        </ScrollArea>
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Heads up!</AlertDialogTitle>
              <AlertDialogDescription>
                New hires welcome! Just note: demo mode doesn't allow deletes. Continue anyway?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={loading}>
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  onClick={async () => {
                    setShowConfirmDialog(false);
                    if (pendingFormData) {
                      await onSubmit(pendingFormData);
                      setPendingFormData(null);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Continue & Add Employee'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
} 