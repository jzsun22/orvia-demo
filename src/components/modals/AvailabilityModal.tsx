'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { RecurringShiftModal } from './RecurringShiftModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useAppToast } from "@/lib/toast-service";
import { formatLocationName, cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_TIMEZONE } from '@/lib/time';
import { formatTime12hrWithMinutes } from '@/lib/time';
import { formatInTimeZone } from 'date-fns-tz';

// Define the availability type to match the backend structure
interface Availability {
  [key: string]: string[]; // Array of availability labels: "morning", "afternoon", "all_day"
}

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

interface LocationHour {
  location_id: string;
  day_of_week: string;
  morning_cutoff: string | null;
}

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    availability: Availability;
  };
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Define availability options
const AVAILABILITY_OPTIONS = [
  { value: 'all_day', label: 'All Day' },
  { value: 'morning', label: 'Morning Only', tooltip: 'Available for shifts ending at 4/5pm' },
  { value: 'afternoon', label: 'Afternoon Only', tooltip: 'Available for shifts starting at 4/5pm' },
  { value: 'none', label: 'Not Available' }
];

// Helper to convert HH:mm string to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0; // Should not happen with valid data
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const getAvailabilityForDay = (
  dayShifts: RecurringShift[],
  morningCutoffTime: string | undefined // HH:mm format
): string[] => {
  if (!dayShifts || dayShifts.length === 0) {
    return []; // 'Not Available'
  }

  const cutoffMinutes = morningCutoffTime ? timeToMinutes(morningCutoffTime) : undefined;

  let allFitInMorning = true;
  let allFitInAfternoon = true;

  for (const shift of dayShifts) {
    const shiftStartMinutes = timeToMinutes(shift.start_time);
    const shiftEndMinutes = timeToMinutes(shift.end_time);

    // Check for morning fit
    if (cutoffMinutes === undefined || shiftEndMinutes > cutoffMinutes) {
      allFitInMorning = false;
    }

    // Check for afternoon fit
    if (cutoffMinutes === undefined || shiftStartMinutes < cutoffMinutes) {
      allFitInAfternoon = false;
    }
  }

  if (allFitInMorning && cutoffMinutes !== undefined) {
    // If they also fit in the afternoon (e.g. cutoff is 12:00, shift is 10:00-11:00),
    // 'morning' is more specific if it applies.
    return ['morning'];
  }

  if (allFitInAfternoon && cutoffMinutes !== undefined) {
    return ['afternoon'];
  }

  // If neither strictly morning nor strictly afternoon, or no cutoff defined,
  // or shifts span the cutoff, then 'all_day' is required.
  return ['all_day'];
};

// Add this utility function at the top with other constants
const capitalizeDay = (day: string): string => {
  if (!day) return '';
  // Ensure day is treated as lowercase before capitalizing first letter for consistency
  const lowerDay = day.toLowerCase();
  return lowerDay.charAt(0).toUpperCase() + lowerDay.slice(1);
};

export function AvailabilityModal({ isOpen, onClose, onSuccess, employee }: AvailabilityModalProps) {
  const { showSuccessToast } = useAppToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | string[] | null>(null);
  const [availability, setAvailability] = useState<Availability>({});
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_OF_WEEK[0]);
  const [selectedOption, setSelectedOption] = useState<string>('all_day');

  // Recurring shifts state
  const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);
  const [isRecurringShiftModalOpen, setIsRecurringShiftModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<RecurringShift | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // State for location hours (morning cutoffs)
  const [locationHoursData, setLocationHoursData] = useState<LocationHour[]>([]);

  // Sort recurring shifts by week order (Monday to Sunday)
  const sortedRecurringShifts = [...recurringShifts].sort(
    (a, b) =>
      DAYS_OF_WEEK.indexOf(a.day_of_week.toLowerCase()) -
      DAYS_OF_WEEK.indexOf(b.day_of_week.toLowerCase())
  );

  // Initialize availability with defaults or existing data
  useEffect(() => {
    // Start with a default object where all days are 'Not Available' ([])
    const defaultAvailability: Availability = {};
    DAYS_OF_WEEK.forEach(day => { // day is already lowercase
      defaultAvailability[day] = []; // Default to 'Not Available'
    });

    // Process employee's existing availability to ensure keys are lowercase
    const processedEmployeeAvailability: Availability = {};
    if (employee.availability) {
      for (const dayKeyInUpstreamData in employee.availability) {
        if (Object.prototype.hasOwnProperty.call(employee.availability, dayKeyInUpstreamData)) {
          const lowerCaseDayKey = dayKeyInUpstreamData.toLowerCase();
          // Only map if the lowercase key is a valid day of the week
          if (DAYS_OF_WEEK.includes(lowerCaseDayKey)) {
            processedEmployeeAvailability[lowerCaseDayKey] = employee.availability[dayKeyInUpstreamData];
          } else {
            // Optionally log or handle unexpected day keys from upstream
            console.warn(`Encountered an unexpected day key '${dayKeyInUpstreamData}' in employee availability data. It will be ignored.`);
          }
        }
      }
    }

    // Merge the employee's processed (lowercase keys) availability onto the defaults
    const initialAvailability = {
      ...defaultAvailability,
      ...processedEmployeeAvailability
    };

    setAvailability(initialAvailability);

    // Set initial selected option based on the first day's merged availability
    // DAYS_OF_WEEK[0] is already lowercase, e.g., 'monday'
    const firstDayAvailability = initialAvailability[DAYS_OF_WEEK[0]] || [];
    if (firstDayAvailability.includes('all_day')) {
      setSelectedOption('all_day');
    } else if (firstDayAvailability.includes('morning')) {
      setSelectedOption('morning');
    } else if (firstDayAvailability.includes('afternoon')) {
      setSelectedOption('afternoon');
    } else { // Handles the case where the first day is [] ('Not Available') or not found
      setSelectedOption('none');
    }
  }, [employee.availability]); // Dependency remains the same

  // Fetch recurring shifts
  useEffect(() => {
    if (isOpen) {
      fetchRecurringShifts();
      fetchLocationHours(); // Fetch location hours when modal opens
    }
  }, [isOpen, employee.id]);

  const fetchRecurringShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_shift_assignments')
        .select(`
          id,
          day_of_week,
          location_id,
          position_id,
          start_time,
          end_time,
          assignment_type,
          location:locations ( 
            id, 
            name 
          ),
          position:positions ( 
            id,
            name
          )
        `)
        .eq('worker_id', employee.id);

      if (error) throw error;

      // Transform the data to match our RecurringShift interface
      const transformedData = data?.map(shift => {
        const positionObject = Array.isArray(shift.position) ? shift.position[0] : shift.position;
        const positionName = positionObject?.name || 'Unknown';

        const locationObject = Array.isArray(shift.location) ? shift.location[0] : shift.location;
        const locationName = locationObject?.name || 'Unknown Location';

        // Map DB assignment_type to the interface type
        let mappedAssignmentType: 'lead' | 'regular' | 'training' = 'regular'; // Default to 'regular'
        if (shift.assignment_type === 'lead' || shift.assignment_type === 'regular' || shift.assignment_type === 'training') {
          mappedAssignmentType = shift.assignment_type;
        }

        return {
          id: shift.id,
          day_of_week: shift.day_of_week,
          location_id: shift.location_id,
          location_name: locationName,
          position_id: shift.position_id,
          position_name: positionName,
          start_time: shift.start_time,
          end_time: shift.end_time,
          assignment_type: mappedAssignmentType, // Use the mapped type
        };
      }) || [];

      setRecurringShifts(transformedData);
    } catch (err: any) {
      console.error('Error fetching recurring shifts:', err);
      setError(err.message);
    }
  };

  const fetchLocationHours = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('location_hours')
        .select('location_id, day_of_week, morning_cutoff');

      if (fetchError) throw fetchError;

      setLocationHoursData(data || []);
    } catch (err: any) {
      console.error('Error fetching location hours:', err);
      // Set an error or handle appropriately if this data is critical for modal functionality
      // For now, discrepancy checks in handleSave will be affected if this fails.
      // setError('Could not load location configuration. Some validation might not work as expected.');
    }
  };

  // Update selected option when day changes
  useEffect(() => {
    const dayAvailability = availability[selectedDay] || [];
    if (dayAvailability.includes('all_day')) {
      setSelectedOption('all_day');
    } else if (dayAvailability.includes('morning')) {
      setSelectedOption('morning');
    } else if (dayAvailability.includes('afternoon')) {
      setSelectedOption('afternoon');
    } else {
      setSelectedOption('none');
    }
  }, [selectedDay, availability]);

  const handleOptionChange = (option: string) => {
    setSelectedOption(option);

    // Map the selected option to the appropriate availability array
    let availabilityArray: string[] = [];

    switch (option) {
      case 'all_day':
        availabilityArray = ['all_day'];
        break;
      case 'morning':
        availabilityArray = ['morning'];
        break;
      case 'afternoon':
        availabilityArray = ['afternoon'];
        break;
      case 'none':
        availabilityArray = [];
        break;
    }

    // Update the availability state with the new array for the selected day
    setAvailability(prev => ({
      ...prev,
      [selectedDay]: availabilityArray
    }));
  };

  // Validate the availability data before saving
  const validateAvailability = (data: Availability): boolean => {
    // Check that all days have valid arrays
    for (const day of DAYS_OF_WEEK) {
      const dayAvailability = data[day];
      if (!Array.isArray(dayAvailability)) {
        return false;
      }

      // Check that each array contains valid values
      for (const value of dayAvailability) {
        if (!['morning', 'afternoon', 'all_day'].includes(value)) {
          return false;
        }
      }
    }

    return true;
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate the availability data structure first
      if (!validateAvailability(availability)) {
        console.error('Invalid availability data format:', availability);
        throw new Error('Invalid availability data format. Please try again.');
      }

      // Check for discrepancies between availability and recurring shifts
      const conflictingShiftsMessages: string[] = [];
      for (const shift of recurringShifts) {
        const dayKey = shift.day_of_week.toLowerCase(); // Use toLowerCase for accessing availability object
        const currentDayAvailability = availability[dayKey];

        if (!currentDayAvailability) {
          // This case should ideally not be reached if availability is initialized for all days
          console.warn(`Availability not found for day: ${dayKey}`);
          continue;
        }

        const locationHour = locationHoursData.find(
          (lh) => lh.location_id === shift.location_id && lh.day_of_week.toLowerCase() === shift.day_of_week.toLowerCase()
        );

        const cutoffTime = locationHour?.morning_cutoff; // HH:mm or null
        const cutoffMinutes = cutoffTime ? timeToMinutes(cutoffTime) : undefined;
        const shiftStartMinutes = timeToMinutes(shift.start_time);
        const shiftEndMinutes = timeToMinutes(shift.end_time);

        let conflict = false;
        let reason = "";

        const shiftDetails = `${shift.position_name} shift (${formatTime12hrWithMinutes(shift.start_time)} - ${formatTime12hrWithMinutes(shift.end_time)}) at ${shift.location_name}`;

        if (currentDayAvailability.length === 0) { // 'Not Available'
          conflict = true;
          reason = `is 'Not Available', but has recurring ${shiftDetails}.`;
        } else if (currentDayAvailability.includes('morning')) {
          if (cutoffMinutes === undefined) {
            conflict = true;
            reason = `is 'Morning Only', but a morning cutoff time is not defined for ${shift.location_name} on ${capitalizeDay(dayKey)}. Cannot verify compatibility with recurring ${shiftDetails}.`;
          } else if (shiftEndMinutes > cutoffMinutes) {
            conflict = true;
            reason = `is 'Morning Only' (requires shifts to end by ${formatTime12hrWithMinutes(cutoffTime!)}), but recurring ${shiftDetails} ends later.`;
          }
        } else if (currentDayAvailability.includes('afternoon')) {
          if (cutoffMinutes === undefined) {
            conflict = true;
            reason = `is 'Afternoon Only', but an afternoon start time (derived from morning cutoff) is not defined for ${shift.location_name} on ${capitalizeDay(dayKey)}. Cannot verify compatibility with recurring ${shiftDetails}.`;
          } else if (shiftStartMinutes < cutoffMinutes) {
            conflict = true;
            reason = `is 'Afternoon Only' (requires shifts to start after ${formatTime12hrWithMinutes(cutoffTime!)}), but recurring ${shiftDetails} starts earlier.`;
          }
        }
        // No conflict for 'all_day' in this specific logic

        if (conflict) {
          conflictingShiftsMessages.push(`On ${capitalizeDay(dayKey)}, availability ${reason}`); // Use capitalizeDay for display in message
        }
      }

      if (conflictingShiftsMessages.length > 0) {
        setError(conflictingShiftsMessages);
        setLoading(false);
        return;
      }

      // Proceed with saving if no structural errors or conflicts
      const { error: updateError } = await supabase
        .from('workers')
        .update({ availability })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      showSuccessToast(`${employee.first_name} ${employee.last_name}'s availability updated.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error updating availability:', err);
      // If setError hasn't been called by the conflict checks (i.e., component's error state is still null),
      // set a generic error from the caught exception.
      if (error === null) { // Check the component's current error state
        setError(err.message || 'An unexpected error occurred while saving.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleAddRecurringShift = () => {
    setIsEditing(false);
    setSelectedShift(null);
    setIsRecurringShiftModalOpen(true);
  };

  const handleEditRecurringShift = (shift: RecurringShift) => {
    setIsEditing(true);
    setSelectedShift(shift);
    setIsRecurringShiftModalOpen(true);
  };

  const handleDeleteRecurringShift = (shift: RecurringShift) => {
    setSelectedShift(shift);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedShift) return;

    try {
      setLoading(true);

      // This is a placeholder for the actual API call
      // In a real implementation, you would delete from the database
      const { error } = await supabase
        .from('recurring_shift_assignments')
        .delete()
        .eq('id', selectedShift.id);

      if (error) throw error;

      // Refresh the list of recurring shifts
      fetchRecurringShifts();
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      console.error('Error deleting recurring shift:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecurringShiftSave = async (data: { savedShift: RecurringShift; isNew: boolean }) => {
    const { savedShift, isNew } = data;

    if (isNew) {
      try {
        // Fetch morning_cutoff for the new shift's location and day
        const { data: locationHourData, error: locationHourError } = await supabase
          .from('location_hours')
          .select('morning_cutoff')
          .eq('location_id', savedShift.location_id)
          .eq('day_of_week', savedShift.day_of_week.toLowerCase())
          .single();

        if (locationHourError && locationHourError.code !== 'PGRST116') { // PGRST116: 'single' row not found
          throw locationHourError;
        }

        const morningCutoff = locationHourData?.morning_cutoff;

        // Combine existing shifts for the day with the new shift
        const dayOfNewShift = savedShift.day_of_week; // This is capitalized from RecurringShift interface
        const shiftsForDay = [
          ...recurringShifts.filter(rs => rs.day_of_week.toLowerCase() === dayOfNewShift.toLowerCase()),
          savedShift, // Add the new shift to the list for calculation
        ];

        const suggestedAvailability = getAvailabilityForDay(shiftsForDay, morningCutoff);

        // Update availability, respecting 'all_day' precedence
        setAvailability(prev => {
          const currentDayAvailability = prev[dayOfNewShift] || [];
          if (currentDayAvailability.includes('all_day')) {
            return { ...prev, [dayOfNewShift]: ['all_day'] };
          }
          return { ...prev, [dayOfNewShift]: suggestedAvailability };
        });

      } catch (err: any) {
        console.error('Error processing new recurring shift for availability update:', err);
        // Optionally set an error state to inform the user
        // setError("Could not automatically update availability due to an error.");
      }
    }

    // Refresh the list of recurring shifts from the database
    await fetchRecurringShifts();
    setIsRecurringShiftModalOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-background p-0 border-[1.5px] border-verylightbeige">
        <ScrollArea className="max-h-[380px] xl:max-h-[600px] 2xl:max-h-full">
          <div className="p-8 xl:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg 2xl:text-xl font-manrope font-medium mb-4">
                Set Availability for {' '}
                <span className="font-bold">
                  {employee.first_name} {employee.last_name}
                </span>
              </DialogTitle>
            </DialogHeader>

            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              <AccordionItem value="item-1" className="my-2">
                <AccordionTrigger className="text-base 2xl:text-lg font-medium text-ashmocha">Availability Settings</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-0 pb-2">
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`p-2 text-xs 2xl:text-sm rounded-md transition-colors ${selectedDay === day
                            ? 'bg-roseblush text-charcoalcocoa border-[1.5px] border-deeproseblush focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-2'
                            : 'bg-oatbeige text-charcoalcocoa hover:bg-roseblush/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-2'
                            }`}
                        >
                          {capitalizeDay(day).slice(0, 3)}.
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm 2xl:text-base pb-2">Availability for {'  '}
                        <span className="text-deeproseblush">
                          {capitalizeDay(selectedDay)}
                        </span>
                      </h3>
                      <div className="space-y-3">
                        {AVAILABILITY_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            htmlFor={`option-${option.value}`}
                            className="flex items-center cursor-pointer select-none"
                          >
                            <input
                              type="radio"
                              id={`option-${option.value}`}
                              name="availability"
                              value={option.value}
                              checked={selectedOption === option.value}
                              onChange={() => handleOptionChange(option.value)}
                              className="peer sr-only"
                            />
                            <span
                              className={`
                            h-5 w-5 mr-2 rounded-full border-[1.5px] border-ashmocha bg-white flex items-center justify-center transition-colors peer-checked:border-accent peer-checked:border-2 duration-200
                          `}
                            >
                              <span
                                className={`
                              h-2.5 w-2.5 rounded-full
                              ${selectedOption === option.value ? 'bg-accent' : 'bg-transparent'}
                              transition
                            `}
                              />
                            </span>
                            <span
                              className={cn("text-xs 2xl:text-sm font-bold transition-colors duration-200",
                                selectedOption === option.value ? "text-charcoalcocoa" : "text-ashmocha font-normal"
                              )}>
                              {option.label}
                            </span>
                            {option.tooltip && (
                              <TooltipProvider>
                                <Tooltip delayDuration={100}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      className="ml-2 text-ashmocha/60 hover:text-ashmocha"
                                      onClick={e => e.preventDefault()}
                                    >
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-charcoalcocoa">{option.tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Summary Section */}
                    <div className="space-y-4">
                      <div className="border-t border-border w-1/2 mx-auto" />
                      <h3 className="font-medium py-2 text-base">Current Availability Summary</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {DAYS_OF_WEEK.map((day) => {
                          const dayAvailability = availability[day] || [];
                          let displayLabel = 'Not Set';

                          if (dayAvailability.includes('all_day')) {
                            displayLabel = 'All Day';
                          } else if (dayAvailability.includes('morning')) {
                            displayLabel = 'Morning Only';
                          } else if (dayAvailability.includes('afternoon')) {
                            displayLabel = 'Afternoon Only';
                          } else if (dayAvailability.length === 0) {
                            displayLabel = 'Not Available';
                          }

                          // Determine styling based on displayLabel
                          const labelClass =
                            displayLabel === "Not Available"
                              ? "text-xs 2xl:text-sm text-ashmocha/60 font-normal"
                              : "text-xs 2xl:text-sm text-deeproseblush font-bold";

                          return (
                            <div key={day} className="flex justify-between items-center">
                              <span className="text-xs 2xl:text-sm font-medium uppercase">{capitalizeDay(day)}</span>
                              <span className={labelClass}>{displayLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-b-0">
                <AccordionTrigger className="text-base 2xl:text-lg font-medium text-ashmocha">Recurring Shifts</AccordionTrigger>
                <AccordionContent>
                  {/* Recurring Shifts Section */}
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-sm 2xl:text-base">Assigned Recurring Shifts</h3>
                      {recurringShifts.length === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddRecurringShift}
                          className="flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Add Recurring Shift
                        </Button>
                      )}
                    </div>

                    {recurringShifts.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-500">
                        No recurring shifts set
                      </div>
                    ) : (
                      <div className={`space-y-4 ${
                        // Determine scroll threshold and max height based on error presence
                        (error && recurringShifts.length > 2) || (!error && recurringShifts.length > 3)
                          ? `overflow-y-auto ${error ? 'max-h-40' : 'max-h-60'} scrollbar scrollbar-thumb-gray-300 scrollbar-track-gray-100`
                          : ''
                        }`}>
                        {sortedRecurringShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="group flex justify-between items-center p-4 bg-oatbeige border border-verylightbeige/50 rounded-md shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">{capitalizeDay(shift.day_of_week)}</div>
                              <div className="text-xs text-ashmocha">
                                {formatLocationName(shift.location_name)} • {shift.position_name} • {formatTime12hrWithMinutes(shift.start_time)} - {formatTime12hrWithMinutes(shift.end_time)}
                                {shift.assignment_type === 'lead' && (
                                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Lead</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-pistachiomist/80"
                                onClick={() => handleEditRecurringShift(shift)}
                              >
                                <Pencil className="h-4 w-4" strokeWidth={1.25} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-errorred/20"
                                onClick={() => handleDeleteRecurringShift(shift)}
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.25} />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddRecurringShift}
                            className="flex items-center gap-1"
                          >
                            <Plus className="h-4 w-4" strokeWidth={1.25} />
                            Add Recurring Shift
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {error && (
              <div className="text-sm text-errorred pt-4">
                {typeof error === 'string' ? (
                  <p>{error}</p>
                ) : (
                  <div>
                    <p className="font-medium">Availability conflicts with one or more recurring shifts:</p>
                    <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                      {error.map((msg, index) => (
                        <li key={index}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-8">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>


      {/* Recurring Shift Modal */}
      <RecurringShiftModal
        isOpen={isRecurringShiftModalOpen}
        onClose={() => setIsRecurringShiftModalOpen(false)}
        onSuccess={handleRecurringShiftSave}
        employeeId={employee.id}
        shift={selectedShift}
        isEditing={isEditing}
        existingRecurringShifts={recurringShifts}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recurring shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
} 