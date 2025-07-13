'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  EditableShiftDetails,
  ShiftAssignmentsWithWorker,
  Worker,
  ShiftTemplate,
  Location,
  Position
} from '../../lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, XCircle } from 'lucide-react'
import { WorkerSelectorDropdown } from '@/components/select/WorkerSelectorDropdown'
import type { ShiftClickContext } from '@/components/scheduling/ScheduleGrid'
import { supabase } from '@/lib/supabase/client'
import { TimePickerInput } from '@/components/ui/TimePicker';
import { useAppToast } from "@/lib/toast-service";
import { formatInTimeZone } from 'date-fns-tz';
import { capitalizeWords, formatLocationName } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { APP_TIMEZONE, formatTime12hr } from '@/lib/time';


const PREP_BARISTA_POSITION_ID = process.env.NEXT_PUBLIC_PREP_BARISTA_POSITION_ID;
const PAIRED_TEMPLATE_ID_1 = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_1;
const PAIRED_TEMPLATE_ID_2 = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_2;

interface PairedShiftInfo {
  partnerShiftId: string;
  partnerShiftEndTime: string;
}

// Define NewShiftClientContext matching the one in WorkerSelectorDropdown and API route
// Consider moving to a shared types.ts file if not already there
interface NewShiftClientContext {
  templateId: string;
  shiftDate: string;    // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
}

interface EditShiftModalProps {
  isOpen: boolean
  onClose: () => void
  shiftContext: ShiftClickContext | null; // Updated prop
  onShiftUpdated: () => void; // Prop to call after successful save
}

const findAssignment = (assignments: ShiftAssignmentsWithWorker[], type: 'lead' | 'regular' | 'training') => {
  return assignments.find(a => a.assignment_type === type) || null;
}

export function EditShiftModal({ isOpen, onClose, shiftContext, onShiftUpdated }: EditShiftModalProps) {
  const { showSuccessToast } = useAppToast(); // Added hook
  const [shiftDetails, setShiftDetails] = useState<EditableShiftDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null)
  const [draftAssignments, setDraftAssignments] = useState<ShiftAssignmentsWithWorker[]>([]);
  const [isNewShift, setIsNewShift] = useState(false);
  const [pairedShiftInfo, setPairedShiftInfo] = useState<PairedShiftInfo | null>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [timeValidationErrors, setTimeValidationErrors] = useState<{
    primary_start?: string;
    primary_end?: string;
    training_start?: string;
    training_end?: string;
  }>({});

  useEffect(() => {
    console.log('[EditShiftModal useEffect] Running main effect. isOpen:', isOpen, 'shiftContext provided:', !!shiftContext);
    if (!isOpen || !shiftContext) {
      // Clear state if modal is closed or no context
      console.log('[EditShiftModal useEffect] Clearing state (closed or no context).');
      setShiftDetails(null);
      setDraftAssignments([]);
      setError(null);
      setPairedShiftInfo(null);
      setTimeValidationErrors({}); // Clear time validation errors
      setIsNewShift(false);
      return;
    }

    const processShiftContext = async () => {
      setIsLoading(true);
      setError(null);
      setShiftDetails(null);
      setDraftAssignments([]);
      setPairedShiftInfo(null);

      if (shiftContext.type === 'existing') {
        setIsNewShift(false);
        try {
          console.log('[EditShiftModal useEffect] Fetching existing shift. Context shiftId:', shiftContext.shiftId);
          const response = await fetch(`/api/get-editable-shift-details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduledShiftId: shiftContext.shiftId }),
          });
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `Error: ${response.status}`)
          }
          const data: EditableShiftDetails = await response.json();
          setShiftDetails(data);
          console.log('[EditShiftModal useEffect] Fetched existing shift. Details scheduledShift.id:', data?.scheduledShift?.id);
          // Log the received currentAssignments in detail
          console.log('[EditShiftModal useEffect] Received currentAssignments from API:', JSON.stringify(data?.currentAssignments, null, 2));
          setDraftAssignments(data.currentAssignments || []);

          if (data.position?.id === PREP_BARISTA_POSITION_ID && data.scheduledShift && PAIRED_TEMPLATE_ID_1 && PAIRED_TEMPLATE_ID_2) {
            const currentTemplateId = data.scheduledShift.template_id;
            const partnerTemplateId = currentTemplateId === PAIRED_TEMPLATE_ID_1 ? PAIRED_TEMPLATE_ID_2 : PAIRED_TEMPLATE_ID_1;

            const { data: partnerShift, error: partnerError } = await supabase
              .from('scheduled_shifts')
              .select('id, end_time')
              .eq('shift_date', data.scheduledShift.shift_date)
              .eq('template_id', partnerTemplateId) 
              .neq('id', data.scheduledShift.id)
              .single();

            if (partnerError) {
              console.warn("Could not find partner for Prep/Barista shift", partnerError);
            } else if (partnerShift && partnerShift.end_time) {
              setPairedShiftInfo({ partnerShiftId: partnerShift.id, partnerShiftEndTime: partnerShift.end_time });
            }
          }

        } catch (e: any) {
          console.error('Failed to fetch shift details for existing shift:', e);
          setError(e.message || 'Failed to load shift details.');
        }
      } else if (shiftContext.type === 'new') {
        setIsNewShift(true);
        // Construct EditableShiftDetails from the context for a new shift
        // This assumes we don't need to fetch full Location/Position objects by ID for the initial modal display
        // and can work with IDs, or the parent (ScheduleGrid) would need to pass more complete objects.

        let fetchedLocationName = `Location ID: ${shiftContext.locationId}`;
        let fetchedPositionName = `Position ID: ${shiftContext.positionId}`;

        try {
          const [locationRes, positionRes] = await Promise.all([
            supabase.from('locations').select('name').eq('id', shiftContext.locationId).single(),
            supabase.from('positions').select('name').eq('id', shiftContext.positionId).single(),
          ]);

          if (locationRes.data?.name) {
            fetchedLocationName = locationRes.data.name;
          } else if (locationRes.error) {
            console.warn(`New shift: Failed to fetch location name for ID ${shiftContext.locationId}:`, locationRes.error.message);
          }

          if (positionRes.data?.name) {
            fetchedPositionName = positionRes.data.name;
          } else if (positionRes.error) {
            console.warn(`New shift: Failed to fetch position name for ID ${shiftContext.positionId}:`, positionRes.error.message);
          }
        } catch (fetchError: any) {
          console.error('New shift: Error fetching location/position names:', fetchError.message);
          // Fallback names are already set, so we can continue
        }

        const partialLocation: Location = { id: shiftContext.locationId, name: fetchedLocationName };
        const partialPosition: Position = { id: shiftContext.positionId, name: fetchedPositionName };

        // Minimal ShiftTemplate object from context
        const partialShiftTemplate: ShiftTemplate = {
          id: shiftContext.templateId,
          location_id: shiftContext.locationId,
          position_id: shiftContext.positionId,
          days_of_week: [], // Not strictly needed for modal display of one shift
          start_time: shiftContext.startTime,
          end_time: shiftContext.endTime,
          lead_type: (shiftContext.leadType === 'opening' || shiftContext.leadType === 'closing' || shiftContext.leadType === null || shiftContext.leadType === undefined) ? shiftContext.leadType : null
        };

        let determinedShiftType: EditableShiftDetails['shiftType'] = 'non-lead';
        if (shiftContext.leadType === 'opening') {
          determinedShiftType = 'opening-lead';
        } else if (shiftContext.leadType === 'closing') {
          determinedShiftType = 'closing-lead';
        }

        const constructedDetails: EditableShiftDetails = {
          scheduledShift: {
            // No id for a new shift until it's saved
            id: `new-shift-${crypto.randomUUID()}`, // Temporary client-side ID, won't be saved
            shift_date: shiftContext.dateString,
            template_id: shiftContext.templateId,
            worker_id: undefined,
            location_id: shiftContext.locationId,
            position_id: shiftContext.positionId,
            start_time: shiftContext.startTime,
            end_time: shiftContext.endTime,
            is_recurring_generated: false,
            created_at: new Date().toISOString(),
          },
          shiftTemplate: partialShiftTemplate,
          currentAssignments: [], // New shift has no current assignments
          shiftType: determinedShiftType,
          location: partialLocation,
          position: partialPosition,
        };
        setShiftDetails(constructedDetails);
        if (constructedDetails.position?.id === PREP_BARISTA_POSITION_ID && PAIRED_TEMPLATE_ID_1 && PAIRED_TEMPLATE_ID_2) {
          // For a new Prep/Barista shift, we need to find the partner template's end time
          const partnerTemplateId = shiftContext.templateId === PAIRED_TEMPLATE_ID_1 ? PAIRED_TEMPLATE_ID_2 : PAIRED_TEMPLATE_ID_1;
          const { data: partnerTemplate } = await supabase
            .from('shift_templates')
            .select('end_time')
            .eq('id', partnerTemplateId)
            .single();
          if (partnerTemplate) {
            setPairedShiftInfo({ partnerShiftId: 'new-partner', partnerShiftEndTime: partnerTemplate.end_time });
          }
        }
        setDraftAssignments([]); // Start with empty assignments for a new shift
      }
      setIsLoading(false);
    };

    processShiftContext();
  }, [isOpen, shiftContext]);

  const handleClose = () => {
    // Reset internal states on close, parent handles isOpen
    setShiftDetails(null);
    setDraftAssignments([]);
    setError(null);
    setPairedShiftInfo(null);
    setTimeValidationErrors({}); // Clear time validation errors
    setIsNewShift(false);
    onClose(); // Call the parent's onClose handler
  }

  const getPrimaryAssignmentType = useCallback((): 'lead' | 'regular' | null => {
    if (!shiftDetails) return null;
    // Use shiftDetails.shiftType which is now correctly set for new shifts too
    if (shiftDetails.shiftType === 'opening-lead' || shiftDetails.shiftType === 'closing-lead') {
      return 'lead';
    }
    if (shiftDetails.shiftType === 'non-lead') {
      return 'regular';
    }
    return null;
  }, [shiftDetails]);

  const primaryAssignmentType = getPrimaryAssignmentType();
  // console.log('[EditShiftModal render] shiftDetails available:', !!shiftDetails);
  // console.log('[EditShiftModal render] Calculated primaryAssignmentType:', primaryAssignmentType);

  const trainingAssignment = findAssignment(draftAssignments, 'training');
  // This logic is now intentionally robust. It first trusts the `shiftType` from the API.
  // If that doesn't yield an assignment (due to data inconsistencies where a 'non-lead' shift
  // might have a 'lead' assignment), it falls back to finding the first non-training assignment.
  const primaryAssignment =
    (primaryAssignmentType ? findAssignment(draftAssignments, primaryAssignmentType) : null) ??
    (draftAssignments.find(a => a.assignment_type !== 'training') || null);

  const validateAssignmentTime = useCallback((
    assignmentType: 'lead' | 'regular' | 'training',
    field: 'assigned_start' | 'assigned_end',
    value: string | null | undefined,
    currentDrafts: ShiftAssignmentsWithWorker[] // Pass current draft assignments
  ): string | undefined => {
    if (!value || !shiftDetails?.scheduledShift) return undefined;

    const originalStartTime = shiftDetails.scheduledShift.start_time;
    const originalEndTime = shiftDetails.scheduledShift.end_time;

    if (field === 'assigned_start' && value < originalStartTime) {
      return `Start cannot be before ${formatTime12hr(originalStartTime)}.`;
    }
    if (field === 'assigned_end' && value > originalEndTime) {
      return `End cannot be after ${formatTime12hr(originalEndTime)}.`;
    }

    const currentAssignment = currentDrafts.find(a => a.assignment_type === assignmentType);
    if (currentAssignment) {
      const checkStart = field === 'assigned_start' ? value : currentAssignment.assigned_start;
      const checkEnd = field === 'assigned_end' ? value : currentAssignment.assigned_end;

      if (checkStart && checkEnd && checkStart > checkEnd) {
        return field === 'assigned_start' ? 'Start after end.' : 'End before start.';
      }
    }
    return undefined;
  }, [shiftDetails]);

  const handlePrimaryWorkerChange = (worker: Worker | null) => {
    if (!primaryAssignmentType || !shiftDetails || !shiftDetails.scheduledShift /* Check scheduledShift exists */) return;
    const currentScheduledShiftId = shiftDetails.scheduledShift.id;

    setDraftAssignments(prev => {
      const otherAssignments = prev.filter(a => a.assignment_type !== primaryAssignmentType);
      if (worker) {
        // If primaryAssignment existed and had a persistent ID, reuse it.
        // Otherwise, it's a new primary assignment for this slot.
        const isExistingPersistentAssignment = primaryAssignment && primaryAssignment.id && !primaryAssignment.id.startsWith('new-assignment-');
        const newPrimaryAssignment: ShiftAssignmentsWithWorker = {
          id: isExistingPersistentAssignment ? primaryAssignment.id : `new-assignment-${crypto.randomUUID()}`,
          scheduled_shift_id: currentScheduledShiftId,
          worker_id: worker.id,
          workers: worker,
          assignment_type: primaryAssignmentType,
          is_manual_override: true,
          created_at: primaryAssignment?.created_at || new Date().toISOString(),
          // Ensure assigned_start and assigned_end are carried over if they existed, or null/undefined if new
          assigned_start: isExistingPersistentAssignment ? primaryAssignment.assigned_start : null,
          assigned_end: isExistingPersistentAssignment ? primaryAssignment.assigned_end : null,
        };
        return [...otherAssignments, newPrimaryAssignment];
      } else {
        // If worker is null, we are effectively unassigning. 
        // If primaryAssignment existed, keep it but with worker_id: null (or handle as per your app's logic for unassignment)
        // For now, this logic implies removing it if the worker is nullified.
        // If your backend expects an assignment with worker_id=null to denote unassignment, adjust here.
        // The current backend logic for add/modify doesn't explicitly handle unassignment via null worker_id in an update,
        // it expects a workerId for updates/adds. Deletion is a separate action.
        return otherAssignments; // Effectively removes the primary assignment if worker is null
      }
    });
  };

  const handleTrainingWorkerChange = (worker: Worker | null) => {
    if (!shiftDetails || !shiftDetails.scheduledShift) return;
    const currentScheduledShiftId = shiftDetails.scheduledShift.id;

    setDraftAssignments(prev => {
      const otherAssignments = prev.filter(a => a.assignment_type !== 'training');
      if (worker) {
        const isExistingPersistentAssignment = trainingAssignment && trainingAssignment.id && !trainingAssignment.id.startsWith('new-assignment-');
        const newTrainingAssignment: ShiftAssignmentsWithWorker = {
          id: isExistingPersistentAssignment ? trainingAssignment.id : `new-assignment-${crypto.randomUUID()}`,
          scheduled_shift_id: currentScheduledShiftId,
          worker_id: worker.id,
          workers: worker,
          assignment_type: 'training',
          is_manual_override: true,
          created_at: trainingAssignment?.created_at || new Date().toISOString(),
          assigned_start: isExistingPersistentAssignment ? trainingAssignment.assigned_start : null,
          assigned_end: isExistingPersistentAssignment ? trainingAssignment.assigned_end : null,
        };
        return [...otherAssignments, newTrainingAssignment];
      }
      return otherAssignments; // Effectively removes the training assignment if worker is null
    });
  };
  const canAddTraining = primaryAssignment && !trainingAssignment;

  const handleUnassignPrimaryAndTrainingFromDraft = () => {
    // We use the IDs from the `primaryAssignment` and `trainingAssignment` objects
    // that are now correctly identified in the component's scope. This ensures
    // we remove the right assignments regardless of any data inconsistencies.
    const idsToRemove = new Set<string>();
    if (primaryAssignment) idsToRemove.add(primaryAssignment.id);
    if (trainingAssignment) idsToRemove.add(trainingAssignment.id);

    if (idsToRemove.size === 0) return;

    setDraftAssignments(prev => prev.filter(a => !idsToRemove.has(a.id)));
    // Clear any time validation errors related to these removed assignments
    setTimeValidationErrors(prevErrors => ({
      ...prevErrors,
      primary_start: undefined,
      primary_end: undefined,
      training_start: undefined,
      training_end: undefined,
    }));
  };

  // Determine the scheduledShiftId to pass to WorkerSelectorDropdown
  // For a new shift, it might not have a real backend ID yet.
  // The dropdown needs a stable string, but it's mostly for fetching eligible workers for THAT shift context.
  // Using templateId + dateString might be a more stable key for fetching eligible workers for a NEW shift slot.
  // However, WorkerSelectorDropdown currently expects a scheduledShiftId string or null.
  // For now, we pass the temporary client-side ID for new shifts, or the real one for existing.
  const effectiveScheduledShiftIdForDropdown = shiftDetails?.scheduledShift?.id || null;

  // Prepare the newShiftClientContext if this is a new shift
  let newShiftContextForDropdown: NewShiftClientContext | null = null;
  if (isNewShift && shiftDetails?.scheduledShift && shiftDetails.shiftTemplate) {
    // For a new shift, shiftDetails.scheduledShift contains date, start/end times, template_id
    // which were derived from the initial shiftContext prop when this modal opened for a new slot.
    newShiftContextForDropdown = {
      templateId: shiftDetails.scheduledShift.template_id,
      shiftDate: shiftDetails.scheduledShift.shift_date,    // This was shiftContext.dateString
      startTime: shiftDetails.scheduledShift.start_time,  // This was shiftContext.startTime
      endTime: shiftDetails.scheduledShift.end_time,    // This was shiftContext.endTime
    };
    // console.log('[EditShiftModal] Preparing newShiftContextForDropdown for a new shift:', newShiftContextForDropdown);
  } else {
    // console.log('[EditShiftModal] Not a new shift or details missing, newShiftContextForDropdown will be null. isNewShift:', isNewShift, 'has shiftDetails:', !!shiftDetails);
  }

  // Helper to format worker names consistently, similar to WorkerSelectorDropdown
  // (Consider moving to shared utils if Worker type is globally defined and accessible)
  const formatWorkerName = (worker: { first_name?: string | null, last_name?: string | null, preferred_name?: string | null } | null | undefined): string => {
    if (!worker) return "N/A";
    const firstName = worker.first_name || '';
    const lastName = worker.last_name || '';
    if (worker.preferred_name && worker.preferred_name.trim() !== '') {
      return `${firstName} (${worker.preferred_name}) ${lastName}`.trim().replace(/\s+/g, ' ');
    }
    return `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
  };

  const handleAssignmentTimeChange = (assignmentType: 'lead' | 'regular' | 'training', field: 'assigned_start' | 'assigned_end', value: string) => {
    setDraftAssignments(prevDrafts => {
      const newDrafts = prevDrafts.map(a => {
        if (a.assignment_type === assignmentType) {
          return { ...a, [field]: value || null }; // Store null if value is empty string
        }
        return a;
      });

      // Perform validation after updating the draft state
      const validationError = validateAssignmentTime(assignmentType, field, value || null, newDrafts);
      const errorKey = `${assignmentType === primaryAssignmentType ? 'primary' : 'training'}_${field.split('_')[1]}` as keyof typeof timeValidationErrors;

      setTimeValidationErrors(prevErrors => ({
        ...prevErrors,
        [errorKey]: validationError,
      }));

      // Also clear the cross-validation error for the other field if this one becomes valid or empty
      // e.g., if assigned_start is changed, re-validate assigned_end in context of new start
      if (!validationError) {
        const otherField = field === 'assigned_start' ? 'assigned_end' : 'assigned_start';
        const otherValue = newDrafts.find(a => a.assignment_type === assignmentType)?.[otherField];
        if (otherValue) {
          const otherErrorKey = `${assignmentType === primaryAssignmentType ? 'primary' : 'training'}_${otherField.split('_')[1]}` as keyof typeof timeValidationErrors;
          const otherValidationError = validateAssignmentTime(assignmentType, otherField, otherValue, newDrafts);
          setTimeValidationErrors(prevErrors => ({
            ...prevErrors,
            [otherErrorKey]: otherValidationError,
          }));
        }
      }
      return newDrafts;
    });
  };

  const handleResetAssignmentTimes = (assignmentType: 'lead' | 'regular' | 'training') => {
    setDraftAssignments(prev => prev.map(a => {
      if (a.assignment_type === assignmentType) {
        return {
          ...a,
          assigned_start: null, // Reset to null 
          assigned_end: null    // Reset to null
        };
      }
      return a;
    }));
    // Clear validation errors for the reset fields
    const prefix = assignmentType === primaryAssignmentType ? 'primary' : 'training';
    setTimeValidationErrors(prevErrors => ({
      ...prevErrors,
      [`${prefix}_start`]: undefined,
      [`${prefix}_end`]: undefined,
    }));
  };

  const isPrepBaristaShift = shiftDetails?.position?.id === PREP_BARISTA_POSITION_ID;

  const renderPrimaryAssignmentSlot = () => {
    if (!shiftDetails || !primaryAssignmentType) return null;
    const assignment = primaryAssignment;
    const showResetButton = assignment && (assignment.assigned_start || assignment.assigned_end);

    return (
      <div className="space-y-2 p-3 border rounded-lg bg-background">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-semibold text-sm 2xl:text-base capitalize">{primaryAssignmentType} Worker:</h4>
          {assignment && ( // Show unassign button only if a primary worker is assigned in draft
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassignPrimaryAndTrainingFromDraft}
              className="text-errorred hover:text-[#9A3E37] hover:border-errorred/60 h-7 px-2"
              disabled={isLoading || isSaving}
            >
              <XCircle className="mr-1 h-4 w-4" /> Unassign
            </Button>
          )}
        </div>
        <WorkerSelectorDropdown
          key="primary-assignment-selector"
          scheduledShiftId={effectiveScheduledShiftIdForDropdown}
          newShiftClientContext={newShiftContextForDropdown}
          targetAssignmentType={primaryAssignmentType}
          currentWorkerId={assignment?.worker_id}
          onWorkerSelect={handlePrimaryWorkerChange}
          placeholder={`Select ${primaryAssignmentType}...`}
          disabled={isLoading}
          popoverContainerRef={dialogContentRef}
          excludeWorkerId={trainingAssignment?.worker_id || null}
        />
        {assignment && assignment.workers && (
          <p className="text-xs text-muted-foreground ml-1">
            {assignment.is_manual_override && assignment.assigned_start && assignment.assigned_end && !isPrepBaristaShift // Show times only if not PrepBarista
              ? `${formatWorkerName(assignment.workers)} (${formatTime12hr(assignment.assigned_start)} - ${formatTime12hr(assignment.assigned_end)})`
              : formatWorkerName(assignment.workers)}
          </p>
        )}
        {assignment && assignment.workers && !isPrepBaristaShift && ( // Hide time inputs for Prep Barista
          <div className="flex items-end gap-4 mt-2">
            <div className="flex flex-col w-[112px] 2xl:w-[116px]">
              <label className="block text-xs font-medium mb-1" htmlFor="primary-assigned-start">Start</label>
              <TimePickerInput
                id="primary-assigned-start"
                value={assignment.assigned_start || undefined}
                onChange={value => handleAssignmentTimeChange(primaryAssignmentType, 'assigned_start', value)}
                className="text-xs 2xl:text-sm w-full"
              />
              <div className="h-6 pt-1 pl-1">
                <p className="text-xs text-errorred whitespace-nowrap">{timeValidationErrors.primary_start || ''}</p>
              </div>
            </div>
            <div className="flex flex-col w-[112px] 2xl:w-[116px]">
              <label className="block text-xs font-medium mb-1" htmlFor="primary-assigned-end">End</label>
              <TimePickerInput
                id="primary-assigned-end"
                value={assignment.assigned_end || undefined}
                onChange={value => handleAssignmentTimeChange(primaryAssignmentType, 'assigned_end', value)}
                className="text-xs 2xl:text-sm w-full"
              />
              <div className="h-6 pt-1 pl-1">
                <p className="text-xs text-errorred whitespace-nowrap">{timeValidationErrors.primary_end || ''}</p>
              </div>
            </div>
            {showResetButton && (
              <div className="flex flex-col">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleResetAssignmentTimes(primaryAssignmentType)}
                  className="h-9 px-2 text-ashmocha hover:text-[#655D59]"
                >
                  Reset Times
                </Button>
                <div className="h-6 pt-1" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTrainingAssignmentSlot = () => {
    if (isPrepBaristaShift) { // No training slot for Prep Barista
      return null;
    }
    if (!shiftDetails || !primaryAssignmentType) return null;
    const assignment = trainingAssignment;
    // If primaryAssignmentType is 'lead', training can be added even if primary (lead) isn't assigned yet.
    // If primaryAssignmentType is 'regular', primary (regular) MUST be assigned before training can be added.
    const canEnableTrainingSlot = primaryAssignmentType === 'lead' || (primaryAssignmentType === 'regular' && primaryAssignment);
    const showResetButton = assignment && (assignment.assigned_start || assignment.assigned_end);

    return (
      <div className="space-y-2 p-3 border rounded-lg bg-background mt-3">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-semibold text-sm 2xl:text-base">(Optional) Training Worker:</h4>
          {assignment && (
            <Button variant="ghost" size="sm" onClick={() => handleTrainingWorkerChange(null)} className="text-errorred hover:text-[#9A3E37] h-7 px-2">
              <XCircle className="mr-1 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        {(assignment || canAddTraining) && canEnableTrainingSlot ? (
          <>
            <WorkerSelectorDropdown
              key="training-assignment-selector"
              scheduledShiftId={effectiveScheduledShiftIdForDropdown}
              newShiftClientContext={newShiftContextForDropdown}
              targetAssignmentType="training"
              currentWorkerId={assignment?.worker_id}
              onWorkerSelect={handleTrainingWorkerChange}
              placeholder="Select training worker..."
              // Disable if primary is not selected (for regular shifts) or if loading
              disabled={isLoading || (primaryAssignmentType === 'regular' && !primaryAssignment)}
              popoverContainerRef={dialogContentRef}
              excludeWorkerId={primaryAssignment?.worker_id || null}
            />
            {assignment && assignment.workers && ( // Hide time inputs for Prep Barista (already handled by function return)
              <>
                <p className="mt-2 text-sm text-gray-800">
                  Assigned: <span className="font-semibold">{assignment.workers.preferred_name || `${assignment.workers.first_name} ${assignment.workers.last_name}`}</span>
                </p>
                <div className="flex items-end gap-2 mt-2">
                  <div className="flex flex-col w-28">
                    <label className="block text-xs font-medium mb-1" htmlFor="training-assigned-start">Start</label>
                    <TimePickerInput
                      id="training-assigned-start"
                      value={assignment.assigned_start || undefined}
                      onChange={value => handleAssignmentTimeChange('training', 'assigned_start', value)}
                      className="w-full"
                    />
                    <div className="h-6 pt-1">
                      <p className="text-xs text-red-500 whitespace-nowrap">{timeValidationErrors.training_start || ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col w-28">
                    <label className="block text-xs font-medium mb-1" htmlFor="training-assigned-end">End</label>
                    <TimePickerInput
                      id="training-assigned-end"
                      value={assignment.assigned_end || undefined}
                      onChange={value => handleAssignmentTimeChange('training', 'assigned_end', value)}
                      className="w-full"
                    />
                    <div className="h-6 pt-1">
                      <p className="text-xs text-red-500 whitespace-nowrap">{timeValidationErrors.training_end || ''}</p>
                    </div>
                  </div>
                  {showResetButton && (
                    <div className="flex flex-col">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleResetAssignmentTimes('training')}
                        className="h-9 px-2 text-xs text-ashmocha hover:text-[#655D59]"
                      >
                        Reset Times
                      </Button>
                      <div className="h-6 pt-1" />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : primaryAssignmentType === 'regular' && !primaryAssignment ? (
          <p className="text-xs text-muted-foreground p-2 text-center">Assign a regular worker before adding a trainee.</p>
        ) : null}
      </div>
    );
  };

  const dialogTitle = isNewShift ? "Assign New Shift" : "Edit Shift";
  const shiftDateStr = shiftDetails?.scheduledShift?.shift_date;
  const dialogDescriptionDate = shiftDateStr
    ? formatInTimeZone(shiftDateStr, APP_TIMEZONE, 'M/d/yyyy') // Correctly format date in APP_TIMEZONE
    : "";
  const formattedStartTime = formatTime12hr(shiftDetails?.scheduledShift?.start_time || '');
  const formattedEndTime = formatTime12hr((pairedShiftInfo ? pairedShiftInfo.partnerShiftEndTime : shiftDetails?.scheduledShift?.end_time) || '');
  const dialogDescriptionTime = shiftDetails?.scheduledShift ? `${formattedStartTime} - ${formattedEndTime}` : "";
  const dialogLocationName = capitalizeWords(shiftDetails?.location?.name) || (shiftContext?.type === 'new' ? `Location ID: ${shiftContext.locationId}` : "");
  const dialogTemplateName = shiftDetails?.shiftTemplate?.id
    ? `Template ID: ${shiftDetails.shiftTemplate.id}`
    : (shiftContext?.type === 'new' && shiftContext.templateId ? `Template ID: ${shiftContext.templateId}` : "");

  let dialogPositionName = capitalizeWords(shiftDetails?.position?.name) || (shiftContext?.type === 'new' ? `Position ID: ${shiftContext.positionId}` : "");
  if (isPrepBaristaShift) {
    dialogPositionName = "Prep / Barista";
  }

  const handleSaveChanges = async () => {
    if (!shiftDetails || !shiftDetails.scheduledShift) {
      setError("Cannot save: Shift details are missing.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setTimeValidationErrors({}); // Clear previous errors before new save attempt

    // Time validation logic
    const primaryAssignment = draftAssignments.find(a => a.assignment_type === 'lead' || a.assignment_type === 'regular');
    const trainingAssignment = draftAssignments.find(a => a.assignment_type === 'training');

    const newTimeValidationErrors: typeof timeValidationErrors = {};
    let isValid = true;

    if (primaryAssignment) {
      const start = primaryAssignment.assigned_start;
      const end = primaryAssignment.assigned_end;
      if (start && !/^\d{2}:\d{2}(:\d{2})?$/.test(start)) {
        newTimeValidationErrors.primary_start = 'Invalid format (HH:mm)';
        isValid = false;
      }
      if (end && !/^\d{2}:\d{2}(:\d{2})?$/.test(end)) {
        newTimeValidationErrors.primary_end = 'Invalid format (HH:mm)';
        isValid = false;
      }
      if (start && end && start >= end) {
        newTimeValidationErrors.primary_end = 'End time must be after start';
        isValid = false;
      }
    }
    if (trainingAssignment) {
        const start = trainingAssignment.assigned_start;
        const end = trainingAssignment.assigned_end;
        if (start && (!/^\d{2}:\d{2}(:\d{2})?$/.test(start))) {
            newTimeValidationErrors.training_start = 'Invalid format (HH:mm)';
            isValid = false;
        }
        if (end && (!/^\d{2}:\d{2}(:\d{2})?$/.test(end))) {
            newTimeValidationErrors.training_end = 'Invalid format (HH:mm)';
            isValid = false;
        }
        if (start && end && start >= end) {
            newTimeValidationErrors.training_end = 'End time must be after start';
            isValid = false;
        }
    }
    
    setTimeValidationErrors(newTimeValidationErrors);

    if (!isValid) {
      setError("Please fix the time errors before saving.");
      return;
    }

    const scheduledShiftData = shiftDetails.scheduledShift;
    const assignmentsToSave = draftAssignments.map(a => ({
      id: (a.id.startsWith('new-assignment-') || a.id.startsWith('new-shift-')) ? undefined : a.id,
      scheduled_shift_id: isNewShift ? undefined : scheduledShiftData.id,
      worker_id: a.worker_id,
      assignment_type: a.assignment_type,
      is_manual_override: a.is_manual_override,
      // For Prep Barista, always send null for custom times as they are not allowed
      assigned_start: isPrepBaristaShift ? null : (a.assigned_start || null),
      assigned_end: isPrepBaristaShift ? null : (a.assigned_end || null),
    }));

    // Filter out training assignments if it's a Prep Barista shift before saving
    const finalAssignmentsToSave = isPrepBaristaShift
      ? assignmentsToSave.filter(a => a.assignment_type !== 'training')
      : assignmentsToSave;

    try {
      let response;
      if (isNewShift) {
        const payload = {
          shiftData: {
            shift_date: scheduledShiftData.shift_date,
            template_id: scheduledShiftData.template_id,
            start_time: scheduledShiftData.start_time,
            end_time: scheduledShiftData.end_time,
          },
          assignments: finalAssignmentsToSave, // Use filtered assignments
        };
        console.log('[EditShiftModal] Saving new shift with payload:', JSON.stringify(payload, null, 2));
        response = await fetch('/api/create-shift-with-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const updatePromises = [];
        // Primary shift update
        const primaryPayload = {
          scheduledShiftId: scheduledShiftData.id,
          assignments: finalAssignmentsToSave,
        };
        console.log('[EditShiftModal] Updating primary shift with payload:', JSON.stringify(primaryPayload, null, 2));
        updatePromises.push(fetch('/api/update-shift-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(primaryPayload),
        }));

        // Partner shift update, if applicable
        if (pairedShiftInfo && pairedShiftInfo.partnerShiftId !== 'new-partner') {
          console.log(`[EditShiftModal DEBUG] Updating partner shift. PairedShiftInfo:`, pairedShiftInfo);
          // For the partner shift, we send the same desired worker assignments, but we strip the
          // database-specific 'id' field. This signals to the 'update-shift-assignments' API
          // that it should reconcile the partner shift's assignments to match this desired state,
          const partnerAssignments = finalAssignmentsToSave.map(({ id, ...rest }) => ({
            ...rest,
            id: undefined, // Force 'add' logic on backend for reconciliation.
          }));

          const partnerPayload = {
            scheduledShiftId: pairedShiftInfo.partnerShiftId,
            assignments: partnerAssignments,
          };
          console.log('[EditShiftModal] Updating partner shift with payload:', JSON.stringify(partnerPayload, null, 2));
          updatePromises.push(fetch('/api/update-shift-assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partnerPayload),
          }));
        }

        const responses = await Promise.all(updatePromises);
        const failedResponse = responses.find(res => !res.ok);
        if (failedResponse) {
          response = failedResponse; // Propagate the first failed response
        } else {
          response = responses[0]; // If all succeed, just use the first for the success path
        }
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save changes: ${response.statusText}`);
      }
      // Determine the correct success message
      const actionText = isNewShift ? "assigned" : "updated";
      const positionForToast = isPrepBaristaShift ? "Prep / Barista" : capitalizeWords(shiftDetails.position?.name);
      const locationForToast = formatLocationName(shiftDetails.location?.name);
      const timeForToast = `${formatTime12hr(shiftDetails.scheduledShift.start_time)} - ${formatTime12hr(pairedShiftInfo ? pairedShiftInfo.partnerShiftEndTime : shiftDetails.scheduledShift.end_time)}`;
      const successMessage = `Shift ${actionText}: ${positionForToast} at ${locationForToast} (${timeForToast}).`;
      
      showSuccessToast(successMessage); // Show success toast
      onShiftUpdated();
      handleClose();
    } catch (e: any) {
      console.error('Failed to save shift changes:', e);
      setError(e.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? null : handleClose())}
    >
      <DialogContent
        ref={dialogContentRef}
        className="bg-background p-0 border-[1.5px] border-verylightbeige"
        onPointerDownOutside={(event) => {
          if ((event.target as HTMLElement)?.closest('[data-radix-interactable-popover]')) {
            event.preventDefault();
          } else {
          }
        }}
      >
        <ScrollArea className="max-h-[380px] xl:max-h-[600px] 2xl:max-h-full">
          <div className="p-8 xl:p-6">
            <DialogHeader>
              <DialogTitle className="mb-1">{dialogTitle}</DialogTitle>
              {shiftDetails && (
                <DialogDescription>
                  {dialogPositionName}
                  {' @ '}{formatLocationName(dialogLocationName)}
                  {' ('}{dialogDescriptionDate}, {dialogDescriptionTime})
                  {isPrepBaristaShift && <span className="block text-xs text-muted-foreground mt-1">(Note: This is a paired Prep/Barista shift. Worker will cover both AM/PM blocks.)</span>}
                </DialogDescription>
              )}
            </DialogHeader>

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 mt-2">Loading shift details...</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {shiftDetails && !isLoading && !error && (
              <div className="grid gap-4 py-8">
                {renderPrimaryAssignmentSlot()}
                {renderTrainingAssignmentSlot()} {/* This will return null for Prep Barista based on its internal logic */}

              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancel</Button>
              <Button
                type="submit"
                disabled={isLoading || isSaving || !shiftDetails || Object.values(timeValidationErrors).some(err => !!err)}
                onClick={handleSaveChanges}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 