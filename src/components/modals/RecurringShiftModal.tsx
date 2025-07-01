'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue } from '@/components/ui/select';
import { Location } from '@/lib/types';
import { useAppToast } from "@/lib/toast-service";
import { formatLocationName } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { APP_TIMEZONE } from '@/lib/time';
import { formatTime12hrWithMinutes } from '@/lib/time';
import { formatInTimeZone } from 'date-fns-tz';

interface RecurringShift {
  id: string;
  day_of_week: string;
  location_id: string;
  location_name: string;
  position_id: string;
  position_name: string;
  start_time: string;
  end_time: string;
  assignment_type: 'lead' | 'regular' | 'training';
}

interface RecurringShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { savedShift: RecurringShift; isNew: boolean }) => void;
  employeeId: string;
  shift?: RecurringShift | null;
  isEditing: boolean;
  existingRecurringShifts: RecurringShift[];
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Add this utility function at the top with other constants
const capitalizeDay = (day: string) => {
  const lowercaseDay = day.toLowerCase();
  return DAYS_OF_WEEK.find(d => d.toLowerCase() === lowercaseDay) || day;
};

export function RecurringShiftModal({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  shift,
  isEditing,
  existingRecurringShifts
}: RecurringShiftModalProps) {
  const { showSuccessToast } = useAppToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allPositions, setAllPositions] = useState<{ id: string; name: string }[]>([]);
  const [filteredPositions, setFilteredPositions] = useState<{ id: string; name: string }[]>([]);
  const [allShiftTemplates, setAllShiftTemplates] = useState<{ id: string; start_time: string; end_time: string }[]>([]);
  const [filteredShiftTemplates, setFilteredShiftTemplates] = useState<{ id: string; start_time: string; end_time: string; lead_type: string | null }[]>([]);

  // Form state
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [positionId, setPositionId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<'lead' | 'regular' | 'training'>('regular');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [employeeFirstName, setEmployeeFirstName] = useState<string>('');

  const isInitialLoad = useRef(true);

  // Reset all form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDayOfWeek('');
      setLocationId('');
      setPositionId('');
      setStartTime('');
      setEndTime('');
      setAssignmentType('regular');
      setSelectedTemplateId('');
      setFilteredPositions([]);
      setFilteredShiftTemplates([]);
      setError(null);
      setEmployeeFirstName('');
      isInitialLoad.current = true;
    }
  }, [isOpen]);

  // Initialize form state from shift prop in edit mode
  useEffect(() => {
    if (isEditing && shift) {
      setDayOfWeek(capitalizeDay(shift.day_of_week));
      setLocationId(shift.location_id);
      setPositionId(shift.position_id);
      setStartTime(shift.start_time);
      setEndTime(shift.end_time);
      setAssignmentType(shift.assignment_type);
      isInitialLoad.current = true;
    }
  }, [isEditing, shift]);

  // Fetch locations, positions, and shift templates
  useEffect(() => {
    if (!isOpen) return;

    console.log('Modal opened, initializing data...');
    setLoading(true);
    setError(null);

    const loadInitialData = async () => {
      try {
        // Fetch worker's first name for toast message
        const { data: workerData, error: workerError } = await supabase
          .from('workers')
          .select('first_name')
          .eq('id', employeeId)
          .single();

        if (workerError) {
          console.error("Could not fetch employee's first name for toast.", workerError);
        } else if (workerData) {
          setEmployeeFirstName(workerData.first_name ?? '');
        }
        
        // Fetch worker-specific locations
        const { data: workerLocationsData, error: workerLocationsError } = await supabase
          .from('worker_locations')
          .select('location:locations!inner(*)')
          .eq('worker_id', employeeId);

        if (workerLocationsError) throw workerLocationsError;

        const fetchedLocations = workerLocationsData.map(wl => wl.location).filter(Boolean) as Location[];
        setLocations(fetchedLocations);
        console.log('Loaded worker-specific locations:', fetchedLocations);

        // Pre-fill location if there's only one
        if (fetchedLocations.length === 1) {
          setLocationId(fetchedLocations[0].id);
        }

        // Fetch worker-specific positions
        const { data: workerPositionsData, error: workerPositionsError } = await supabase
          .from('worker_positions')
          .select('position:positions!inner(id, name)')
          .eq('worker_id', employeeId);

        if (workerPositionsError) throw workerPositionsError;

        const workerPositions = workerPositionsData.map(wp => wp.position).filter(Boolean);

        if (!workerPositions) {
          throw new Error('No positions data received for this worker');
        }

        console.log('Loaded worker-specific positions:', workerPositions);
        setAllPositions(workerPositions as { id: string; name: string }[]);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load form data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isOpen, employeeId]);

  // Update filtered shift templates when location and position change (for both new and edit modes)
  useEffect(() => {
    if (locationId && positionId && dayOfWeek) {
      console.log('Location/position/day changed, fetching templates for:', { locationId, positionId, dayOfWeek });
      fetchShiftTemplatesForLocationAndPosition(locationId, positionId);
      // Only reset times if we're not in edit mode or if we're changing position
      if (!isEditing || (shift && positionId !== shift.position_id)) {
        setStartTime('');
        setEndTime('');
      }
    } else {
      setFilteredShiftTemplates([]);
    }
  }, [locationId, positionId, dayOfWeek, isEditing, shift]);

  // Auto-select end time if only one option exists for the selected start time
  useEffect(() => {
    if (!startTime) {
      setEndTime('');
      setSelectedTemplateId('');
      return;
    }
    // Find all end times for the selected start time
    const endTimeSet = new Set(filteredShiftTemplates
      .filter(template => template.start_time === startTime)
      .map(template => template.end_time));
    const uniqueEndTimeOptions = Array.from(endTimeSet);
    
    // Auto-select end time if only one option exists for the selected start time
    if (uniqueEndTimeOptions.length === 1) {
      const template = filteredShiftTemplates.find(t => t.start_time === startTime && t.end_time === uniqueEndTimeOptions[0]);
      if (template) {
        setEndTime(template.end_time);
        setSelectedTemplateId(template.id);
        if (!isInitialLoad.current) {
          setAssignmentType(template.lead_type ? 'lead' : 'regular');
        }
      }
    } else {
      setEndTime('');
      setSelectedTemplateId('');
    }
    if (isInitialLoad.current && (isEditing || startTime)) {
      isInitialLoad.current = false;
    }
  }, [startTime, filteredShiftTemplates, isEditing]);

  const fetchPositionsForLocation = useCallback(async (locationId: string) => {
    try {
      console.log('Fetching positions for location ID:', locationId);
      const { data: locationPositions, error: locationPositionsError } = await supabase
        .from('location_positions')
        .select('position_id')
        .eq('location_id', locationId);

      if (locationPositionsError) throw locationPositionsError;
      console.log('Location positions:', locationPositions);

      const positionsForLocation = allPositions.filter(pos =>
        locationPositions?.some(lp => lp.position_id === pos.id)
      );
      console.log('Filtered positions:', positionsForLocation);
      setFilteredPositions(positionsForLocation);
      if (positionsForLocation.length === 1) {
        setPositionId(positionsForLocation[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching positions for location:', err);
      setError(err.message);
    }
  }, [allPositions]);

  // Update filtered positions when location changes (for both new and edit modes)
  useEffect(() => {
    if (locationId) {
      console.log('Location changed, fetching positions for:', locationId);
      fetchPositionsForLocation(locationId);
    } else {
      setFilteredPositions([]);
    }
  }, [locationId, fetchPositionsForLocation]);

  const fetchShiftTemplatesForLocationAndPosition = async (locationId: string, positionId: string) => {
    try {
      console.log('Fetching templates for:', { locationId, positionId, dayOfWeek });

      // Query shift templates with the correct column names
      const { data, error } = await supabase
        .from('shift_templates')
        .select('id, start_time, end_time, days_of_week, lead_type')
        .eq('location_id', locationId)
        .eq('position_id', positionId);

      if (error) throw error;

      console.log('Raw templates data:', data);

      // Filter templates to only include those for the selected day of week
      const templatesForDay = data?.filter(template => {
        if (!template.days_of_week || !Array.isArray(template.days_of_week)) {
          console.log('Template missing days_of_week or not an array:', template);
          return false;
        }

        // Convert both to lowercase for comparison
        const selectedDay = dayOfWeek.toLowerCase();
        return template.days_of_week.some(day => day.toLowerCase() === selectedDay);
      }) || [];

      console.log('Filtered templates for day:', templatesForDay);

      // Sort the templates chronologically by start_time
      templatesForDay.sort((a, b) => {
        const [aHours, aMinutes] = a.start_time.split(':').map(Number);
        const [bHours, bMinutes] = b.start_time.split(':').map(Number);

        if (aHours !== bHours) {
          return aHours - bHours;
        }
        return aMinutes - bMinutes;
      });

      setFilteredShiftTemplates(templatesForDay);
      if (templatesForDay.length === 1) {
        setStartTime(templatesForDay[0].start_time);
        setEndTime(templatesForDay[0].end_time);
      }
    } catch (err: any) {
      console.error('Error fetching shift templates for location and position:', err);
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    // Basic validation (can be expanded)
    if (!dayOfWeek || !locationId || !positionId || !startTime || !endTime) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    // Duplicate check
    const isDuplicate = existingRecurringShifts.some(
      (existingShift) => {
        // If editing, skip comparing the shift with its original version if no key fields changed.
        // However, the main check is if the new/edited details match *any other* existing shift.
        if (isEditing && shift && existingShift.id === shift.id) {
          return false; // Don't compare the shift being edited against itself
        }
        return (
          existingShift.day_of_week.toLowerCase() === dayOfWeek.toLowerCase() &&
          existingShift.location_id === locationId &&
          existingShift.position_id === positionId &&
          existingShift.start_time === startTime &&
          existingShift.end_time === endTime
          // We don't check assignment_type for duplication, as a lead vs regular for the same slot is distinct enough
          // and usually wouldn't occur. If it should also be part of uniqueness, add:
          // && existingShift.assignment_type === assignmentType 
        );
      }
    );

    if (isDuplicate) {
      setError('An identical recurring shift already exists for this employee.');
      setLoading(false);
      return;
    }

    const shiftDataToSave = {
      worker_id: employeeId,
      day_of_week: dayOfWeek.toLowerCase(), // Store lowercase in DB
      location_id: locationId,
      position_id: positionId,
      start_time: startTime,
      end_time: endTime,
      assignment_type: assignmentType,
    };

    try {
      let savedShiftResponse;
      let savedShiftId = shift?.id;

      if (isEditing && shift?.id) {
        const { data, error } = await supabase
          .from('recurring_shift_assignments')
          .update(shiftDataToSave)
          .eq('id', shift.id)
          .select()
          .single();
        if (error) throw error;
        savedShiftResponse = data;
      } else {
        const { data, error } = await supabase
          .from('recurring_shift_assignments')
          .insert(shiftDataToSave)
          .select()
          .single();
        if (error) throw error;
        savedShiftResponse = data;
        savedShiftId = data?.id;
      }

      if (!savedShiftResponse || !savedShiftId) {
        throw new Error('Failed to save shift or get ID back.');
      }

      const actionText = isEditing ? 'updated' : 'added';
      const namePart = employeeFirstName ? `for ${employeeFirstName} ` : '';
      const successMessage = `Recurring shift ${namePart}has been ${actionText}.`;
      showSuccessToast(successMessage);

      // Construct the RecurringShift object for the onSuccess callback
      const selectedLocation = locations.find(loc => loc.id === locationId);
      const selectedPosition = allPositions.find(pos => pos.id === positionId);

      const fullSavedShift: RecurringShift = {
        id: savedShiftId,
        day_of_week: capitalizeDay(savedShiftResponse.day_of_week), // Capitalize for consistency
        location_id: savedShiftResponse.location_id,
        location_name: selectedLocation?.name || 'Unknown Location',
        position_id: savedShiftResponse.position_id,
        position_name: selectedPosition?.name || 'Unknown Position',
        start_time: savedShiftResponse.start_time,
        end_time: savedShiftResponse.end_time,
        assignment_type: savedShiftResponse.assignment_type as 'lead' | 'regular' | 'training',
      };

      onSuccess({ savedShift: fullSavedShift, isNew: !isEditing });
      handleClose(); // Close modal on success
    } catch (err: any) {
      console.error('Error saving recurring shift:', err);
      setError(err.message || 'Failed to save recurring shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const uniqueStartTimeTemplates = filteredShiftTemplates.reduce((acc, current) => {
    if (!acc.find(item => item.start_time === current.start_time)) {
      acc.push(current);
    }
    return acc;
  }, [] as typeof filteredShiftTemplates);

  const getUniqueStartTimes = () => {
    const startTimeSet = new Set(filteredShiftTemplates.map(template => template.start_time));
    return Array.from(startTimeSet).sort();
  };

  const getUniqueEndTimesForStartTime = (selectedStartTime: string): { time: string; templateId: string | undefined }[] => {
    if (!selectedStartTime) {
      return [];
    }
    const templatesForStartTime = filteredShiftTemplates
      .filter(template => template.start_time === selectedStartTime);

    const endTimeMap = new Map<string, string>();
    templatesForStartTime.forEach(t => {
      // If there are multiple templates with same start/end time, we just pick one id.
      // This can be improved if we need to distinguish between them.
      if (!endTimeMap.has(t.end_time)) {
        endTimeMap.set(t.end_time, t.id);
      }
    });

    return Array.from(endTimeMap.entries())
      .map(([time, templateId]) => ({ time, templateId }))
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-background p-0 border-[1.5px] border-verylightbeige">
        <ScrollArea className="max-h-[380px] xl:max-h-[600px] 2xl:max-h-full">
          <div className="p-8 xl:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg 2xl:text-xl font-manrope font-medium mb-4">
                {isEditing ? 'Edit Recurring Shift' : 'Add Recurring Shift'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs 2xl:text-sm">Day of Week</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={isEditing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs 2xl:text-sm">Location</Label>
                  <Select value={locationId} onValueChange={setLocationId} disabled={isEditing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location">
                        {locationId ? formatLocationName(locations.find(loc => loc.id === locationId)?.name) : "Select location"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {formatLocationName(location.name)}
                        </SelectItem>
                      ))}
                      {locations.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground">Loading locations...</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs 2xl:text-sm">Position</Label>
                  <Select
                    value={positionId}
                    onValueChange={setPositionId}
                    disabled={!locationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={locationId ? "Select position" : "Select a location first"}>
                        {positionId && allPositions.find(p => p.id === positionId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPositions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs 2xl:text-sm">Start Time</Label>
                    <Select
                      value={startTime}
                      onValueChange={setStartTime}
                      disabled={!locationId || !positionId || !dayOfWeek}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !locationId
                              ? 'Select a location first'
                              : !positionId
                                ? 'Select a position first'
                                : !dayOfWeek
                                  ? 'Select a day of week first'
                                  : 'Select start time'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {getUniqueStartTimes().map((time, index) => (
                          <SelectItem key={index} value={time}>
                            {formatTime12hrWithMinutes(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs 2xl:text-sm">End Time</Label>
                    <Select
                      value={endTime}
                      onValueChange={(timeValue) => {
                        if (!timeValue) return;

                        const selectedTemplate = filteredShiftTemplates.find(
                          t => t.start_time === startTime && t.end_time === timeValue
                        );

                        if (selectedTemplate) {
                          setSelectedTemplateId(selectedTemplate.id);
                          setEndTime(selectedTemplate.end_time);
                          setAssignmentType(selectedTemplate.lead_type ? 'lead' : 'regular');
                        }
                      }}
                      disabled={!startTime}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select end time">
                          {endTime ? formatTime12hrWithMinutes(endTime) : 'Select end time'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {getUniqueEndTimesForStartTime(startTime).map((item, index) => (
                          <SelectItem key={index} value={item.time}>
                            {formatTime12hrWithMinutes(item.time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs 2xl:text-sm">Assignment Type</Label>
                  <div className="flex gap-4">
                    <label htmlFor="assignment-regular" className="flex items-center cursor-pointer select-none">
                      <input
                        type="radio"
                        id="assignment-regular"
                        name="assignmentType"
                        value="regular"
                        checked={assignmentType === 'regular'}
                        onChange={() => setAssignmentType('regular')}
                        className="peer sr-only"
                      />
                      <span
                        className={`h-5 w-5 mr-2 rounded-full border-[1.5px] border-ashmocha bg-white flex items-center justify-center transition-colors peer-checked:border-accent peer-checked:border-2 duration-200`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${assignmentType === 'regular' ? 'bg-accent' : 'bg-transparent'} transition`}
                        />
                      </span>
                      <span className={
                        `text-sm font-medium transition-colors duration-200 ${assignmentType === 'regular' ? 'text-charcoalcocoa' : 'text-ashmocha font-medium'}`
                      }>
                        Regular
                      </span>
                    </label>
                    <label htmlFor="assignment-lead" className="flex items-center cursor-pointer select-none">
                      <input
                        type="radio"
                        id="assignment-lead"
                        name="assignmentType"
                        value="lead"
                        checked={assignmentType === 'lead'}
                        onChange={() => setAssignmentType('lead')}
                        className="peer sr-only"
                      />
                      <span
                        className={`h-5 w-5 mr-2 rounded-full border-[1.5px] border-ashmocha bg-white flex items-center justify-center transition-colors peer-checked:border-accent peer-checked:border-2 duration-200`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${assignmentType === 'lead' ? 'bg-accent' : 'bg-transparent'} transition`}
                        />
                      </span>
                      <span className={
                        `text-sm font-medium transition-colors duration-200 ${assignmentType === 'lead' ? 'text-charcoalcocoa' : 'text-ashmocha font-medium'}`
                      }>
                        Lead
                      </span>
                    </label>
                    <label htmlFor="assignment-training" className="flex items-center cursor-not-allowed select-none opacity-60">
                      <input
                        type="radio"
                        id="assignment-training"
                        name="assignmentType"
                        value="training"
                        checked={assignmentType === 'training'}
                        onChange={() => { }}
                        className="peer sr-only"
                        disabled
                      />
                      <span
                        className={`h-5 w-5 mr-2 rounded-full border-[1.5px] border-ashmocha bg-white flex items-center justify-center transition-colors duration-200`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${assignmentType === 'training' ? 'bg-accent' : 'bg-transparent'} transition`}
                        />
                      </span>
                      <span className={
                        `text-sm transition-colors duration-200 text-ashmocha font-medium`
                      }>
                        Training
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-errorred">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-8">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : isEditing ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 