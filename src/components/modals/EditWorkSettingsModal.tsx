'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { workSettingsSchema, type WorkSettingsFormData } from '@/lib/schemas/employee';
import { supabase } from '@/lib/supabase/client';
import { fetchAllLocations } from '@/lib/supabase';
import { Location, Position } from '@/lib/types';
import { useAppToast } from "@/lib/toast-service";
import { capitalizeWords } from '@/lib/utils';

interface FetchedLocationPosition {
  id: string;
  location_id: string;
  position: Position;
}

interface ExtendedWorker {
  id: string;
  first_name: string; // For display purposes
  last_name: string; // For display purposes
  is_lead: boolean;
  location_ids: string[];
  positions: string[];
}

interface EditWorkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee: ExtendedWorker;
}

export function EditWorkSettingsModal({ isOpen, onClose, onSuccess, employee }: EditWorkSettingsModalProps) {
  const { showSuccessToast } = useAppToast();
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allLocationPositions, setAllLocationPositions] = useState<FetchedLocationPosition[]>([]);
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control
  } = useForm<WorkSettingsFormData>({
    resolver: zodResolver(workSettingsSchema),
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const locations = await fetchAllLocations(supabase);
        setAllLocations(locations);

        const { data: locationPositionsData, error: lpError } = await supabase
          .from('location_positions')
          .select('id, location_id, position:positions(id, name)');

        if (lpError) throw lpError;

        const fetchedData: FetchedLocationPosition[] = (locationPositionsData || []).map((item: any) => ({
          id: item.id,
          location_id: item.location_id,
          position: Array.isArray(item.position) ? item.position[0] : item.position,
        })).filter(lp => lp.position);

        setAllLocationPositions(fetchedData);
      } catch (err: any) {
        setError('Failed to load required data.');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen && employee) {
      reset({
        is_lead: employee.is_lead,
        positions: employee.positions,
        location_ids: employee.location_ids,
      });
    }
  }, [isOpen, employee, reset]);

  const watchLocationIds = watch('location_ids', employee.location_ids);
  useEffect(() => {
    if (watchLocationIds?.length > 0) {
      const relevantMappings = allLocationPositions.filter(lp => watchLocationIds.includes(lp.location_id));
      const positionsInSelectedLocations = relevantMappings
        .map(lp => lp.position)
        .filter((pos, index, self) => pos && index === self.findIndex(p => p?.id === pos.id));
      setFilteredPositions(positionsInSelectedLocations);
    } else {
      setFilteredPositions([]);
    }
  }, [watchLocationIds, allLocationPositions]);

  const onSubmit: SubmitHandler<WorkSettingsFormData> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      await supabase.from('workers').update({ is_lead: data.is_lead }).eq('id', employee.id);

      const { data: existingLocations } = await supabase.from('worker_locations').select('location_id').eq('worker_id', employee.id);
      const existingLocationIds = existingLocations?.map(loc => loc.location_id) || [];
      const locationsToAdd = data.location_ids.filter(id => !existingLocationIds.includes(id));
      const locationsToRemove = existingLocationIds.filter(id => !data.location_ids.includes(id));

      if (locationsToAdd.length > 0) {
        await supabase.from('worker_locations').insert(locationsToAdd.map(location_id => ({ worker_id: employee.id, location_id })));
      }
      if (locationsToRemove.length > 0) {
        await supabase.from('worker_locations').delete().eq('worker_id', employee.id).in('location_id', locationsToRemove);
      }

      const { data: existingPositions } = await supabase.from('worker_positions').select('position_id').eq('worker_id', employee.id);
      const existingPositionIds = existingPositions?.map(p => p.position_id) || [];
      const positionsToAdd = data.positions.filter(id => !existingPositionIds.includes(id));
      const positionsToRemove = existingPositionIds.filter(id => !data.positions.includes(id));

      if (positionsToAdd.length > 0) {
        await supabase.from('worker_positions').insert(positionsToAdd.map(position_id => ({ worker_id: employee.id, position_id })));
      }
      if (positionsToRemove.length > 0) {
        await supabase.from('worker_positions').delete().eq('worker_id', employee.id).in('position_id', positionsToRemove);
      }

      showSuccessToast(`Work settings for ${employee.first_name} updated.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#f8f9f7]">
        <DialogHeader>
          <DialogTitle className="text-xl font-manrope font-semibold">Edit Work Settings</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-red-500 text-center mb-4">{error}</p>}
        {loading && !error && <p className="text-sm text-muted-foreground text-center mb-4">Loading data...</p>}
        
        {!loading && !error && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Controller
              name="location_ids"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Locations</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {allLocations.map((location) => (
                      <div key={location.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`location-${location.id}`}
                          checked={field.value?.includes(location.id)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...(field.value || []), location.id]
                              : (field.value || []).filter((id) => id !== location.id);
                            field.onChange(newValue);
                          }}
                        />
                        <Label htmlFor={`location-${location.id}`} className="font-normal">{capitalizeWords(location.name)}</Label>
                      </div>
                    ))}
                  </div>
                  {errors.location_ids && <p className="text-sm text-red-500">{errors.location_ids.message}</p>}
                </div>
              )}
            />

            <Controller
              name="positions"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Positions</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {filteredPositions.map((position) => (
                      <div key={position.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`position-${position.id}`}
                          checked={field.value?.includes(position.id)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...(field.value || []), position.id]
                              : (field.value || []).filter((id) => id !== position.id);
                            field.onChange(newValue);
                          }}
                        />
                        <Label htmlFor={`position-${position.id}`} className="font-normal">{position.name}</Label>
                      </div>
                    ))}
                  </div>
                  {filteredPositions.length === 0 && watchLocationIds && watchLocationIds.length > 0 && <p className="text-sm text-muted-foreground">No positions for selected locations.</p>}
                  {(!watchLocationIds || watchLocationIds.length === 0) && <p className="text-sm text-muted-foreground">Select a location to see positions.</p>}
                  {errors.positions && <p className="text-sm text-red-500">{errors.positions.message}</p>}
                </div>
              )}
            />

            <Controller
                name="is_lead"
                control={control}
                render={({ field }) => (
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="is_lead"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                        <Label htmlFor="is_lead" className="text-sm font-normal">
                            Can be assigned as Opening/Closing Lead
                        </Label>
                    </div>
                )}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-6 mt-6">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 