import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
type WorkerSummaryRow = Pick<Database['public']['Tables']['workers']['Row'], 'id' | 'first_name' | 'last_name' | 'preferred_name' | 'job_level'>;
type LocationRow = Pick<Database['public']['Tables']['locations']['Row'], 'id' | 'name'>;
type ShiftTemplateRow = Database['public']['Tables']['shift_templates']['Row'];
type PositionSummaryRow = Pick<Database['public']['Tables']['positions']['Row'], 'id' | 'name'>;
type ScheduledShiftRow = Pick<Database['public']['Tables']['scheduled_shifts']['Row'], 'id' | 'shift_date' | 'template_id' | 'start_time' | 'end_time' | 'is_recurring_generated'>;
type ShiftAssignmentWithWorker = Pick<Database['public']['Tables']['shift_assignments']['Row'], 'scheduled_shift_id' | 'worker_id' | 'assignment_type' | 'is_manual_override' | 'assigned_start' | 'assigned_end'> & { workers: Pick<Database['public']['Tables']['workers']['Row'], 'id' | 'first_name' | 'last_name' | 'preferred_name' | 'job_level'> | null; };

const PT_TIMEZONE = 'America/Los_Angeles';

export interface Location {
  id: string;
  name: string;
}

export interface Worker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name?: string | null;
  job_level?: string | null;
}

export interface ShiftTemplate {
  id: string;
  location_id: string | null;
  position_id: string | null;
  days_of_week: string[] | null;
  start_time: string;
  end_time: string;
  lead_type?: string | null;
  schedule_column_group?: number | null;
}

export interface Position {
  id: string;
  name: string;
}

export interface ScheduledShiftForGrid {
  id: string;
  shift_date: string;
  template_id: string | null;
  start_time: string | null;
  end_time: string | null;
  is_recurring_generated: boolean | null;
  positionName?: string; // Derived

  // Primary assignment details
  worker_id: string | null;
  workerName?: string; // Assigned worker's formatted name
  job_level?: string | null;
  assigned_start?: string | null;
  assigned_end?: string | null;
  is_manual_override?: boolean | null; // From shift_assignments

  // Training assignment details
  trainingWorkerId?: string | null;
  trainingWorkerName?: string; // Trainee's Preferred or First name
  trainingWorkerAssignedStart?: string | null;
  trainingWorkerAssignedEnd?: string | null;
  isTrainingAssignmentManuallyOverridden?: boolean | null;
}

export interface SchedulePageData {
  location: Location;
  workers: Worker[];
  allShiftTemplates: ShiftTemplate[];
  positions: Position[];
  scheduledShifts: ScheduledShiftForGrid[];
}

const schedulePageFetcher = async ([locationSlug, weekStart]: [string, Date]): Promise<SchedulePageData> => {
  // 1. Fetch Location
  const { data: location, error: locError } = await supabase
    .from("locations")
    .select<'id, name', LocationRow>('id, name')
    .eq("name", locationSlug.toLowerCase().trim())
    .single();
  if (locError) throw new Error(locError.message);
  if (!location) throw new Error("Location not found");

  // 2. Fetch Base Meta (workers, templates, positions)
  const [workersRes, templatesRes, positionsRes] = await Promise.all([
    supabase.from("workers").select<'id, first_name, last_name, preferred_name, job_level', WorkerSummaryRow>('id, first_name, last_name, preferred_name, job_level'),
    supabase.from("shift_templates").select<'*', ShiftTemplateRow>('*'),
    supabase.from("positions").select<'id, name', PositionSummaryRow>('id, name'),
  ]);
  if (workersRes.error) throw new Error(workersRes.error.message);
  if (templatesRes.error) throw new Error(templatesRes.error.message);
  if (positionsRes.error) throw new Error(positionsRes.error.message);

  const workers = workersRes.data;
  const allShiftTemplates = templatesRes.data;
  const positions = positionsRes.data;

  // 3. Fetch scheduled shifts
  const firstDayOfWeekQuery = weekStart;
  const lastDayOfWeekQuery = new Date(firstDayOfWeekQuery.getTime());
  lastDayOfWeekQuery.setUTCDate(lastDayOfWeekQuery.getUTCDate() + 6);
  const ptDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: PT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  const startDateQueryStr = ptDateFormatter.format(firstDayOfWeekQuery);
  const endDateQueryStr = ptDateFormatter.format(lastDayOfWeekQuery);

  const { data: allShiftsForDateRange, error: shiftsError } = await supabase
    .from("scheduled_shifts")
    .select<'id, shift_date, template_id, start_time, end_time, is_recurring_generated', ScheduledShiftRow>('id, shift_date, template_id, start_time, end_time, is_recurring_generated')
    .gte("shift_date", startDateQueryStr).lte("shift_date", endDateQueryStr);
  if (shiftsError) throw new Error(shiftsError.message);
  if (!allShiftsForDateRange || allShiftsForDateRange.length === 0) {
    return { location, workers, allShiftTemplates, positions, scheduledShifts: [] };
  }

  const templateIdsForCurrentLocation = allShiftTemplates.filter(t => t.location_id === location.id).map(t => t.id);
  const relevantScheduledShifts = allShiftsForDateRange.filter(s =>
    s.template_id !== null && templateIdsForCurrentLocation.includes(s.template_id)
  );
  if (relevantScheduledShifts.length === 0) {
    return { location, workers, allShiftTemplates, positions, scheduledShifts: [] };
  }

  const shiftIds = relevantScheduledShifts.map(s => s.id);
  const { data: assignmentsData, error: assignmentsError } = await supabase.from('shift_assignments')
    .select(`scheduled_shift_id, worker_id, assignment_type, is_manual_override, assigned_start, assigned_end, workers (id, first_name, last_name, preferred_name, job_level)`)
    .in('scheduled_shift_id', shiftIds);
  if (assignmentsError) throw new Error(assignmentsError.message);
  const assignmentsWithWorkers: ShiftAssignmentWithWorker[] = (assignmentsData ?? []) as ShiftAssignmentWithWorker[];

  const populatedShifts: ScheduledShiftForGrid[] = relevantScheduledShifts.map(shift => {
    const shiftAssignments = assignmentsWithWorkers.filter(a => a.scheduled_shift_id === shift.id);
    let primaryAssignment = shiftAssignments.find(a => a.assignment_type === 'lead') || shiftAssignments.find(a => a.assignment_type === 'regular');
    let workerName, assignedWorkerId = null, assignedStartTime = null, assignedEndTime = null, isManualOverride = null, workerJobLevel = null;
    if (primaryAssignment?.workers) {
      const workerData = primaryAssignment.workers as any;
      workerName = workerData.preferred_name?.trim() || workerData.first_name?.trim() || 'Unknown Worker';
      assignedWorkerId = workerData.id; workerJobLevel = workerData.job_level || null;
      assignedStartTime = primaryAssignment.assigned_start || null; assignedEndTime = primaryAssignment.assigned_end || null;
      isManualOverride = primaryAssignment.is_manual_override ?? null;
    }

    const trainingAssignment = shiftAssignments.find(a => a.assignment_type === 'training');
    let trainingWorkerId = null, trainingWorkerName, trainingWorkerAssignedStartTime = null, trainingWorkerAssignedEndTime = null, isTrainingAssignmentManuallyOverridden = null;
    if (trainingAssignment?.workers) {
      const traineeData = trainingAssignment.workers as any;
      trainingWorkerName = traineeData.preferred_name?.trim() || traineeData.first_name?.trim() || 'Trainee';
      trainingWorkerId = traineeData.id;
      trainingWorkerAssignedStartTime = trainingAssignment.assigned_start || null; trainingWorkerAssignedEndTime = trainingAssignment.assigned_end || null;
      isTrainingAssignmentManuallyOverridden = trainingAssignment.is_manual_override ?? null;
    }

    const template = allShiftTemplates.find(t => t.id === shift.template_id);
    const position = template ? positions.find(p => p.id === template.position_id) : null;

    return {
      ...shift,
      positionName: position ? position.name : 'N/A',
      worker_id: assignedWorkerId, workerName: workerName || undefined, job_level: workerJobLevel,
      assigned_start: assignedStartTime, assigned_end: assignedEndTime, is_manual_override: isManualOverride,
      trainingWorkerId, trainingWorkerName: trainingWorkerName || undefined,
      trainingWorkerAssignedStart: trainingWorkerAssignedStartTime, trainingWorkerAssignedEnd: trainingWorkerAssignedEndTime,
      isTrainingAssignmentManuallyOverridden,
    };
  });

  return { location, workers, allShiftTemplates, positions, scheduledShifts: populatedShifts };
};

export const useSchedulePageData = (locationSlug: string | undefined | null, weekStart: Date) => {
    const { data, error, isLoading, mutate } = useSWR<SchedulePageData>(
      locationSlug ? [locationSlug, weekStart] : null,
      () => schedulePageFetcher([locationSlug as string, weekStart])
    );
  
    return {
      data,
      error,
      isLoading,
      mutate,
    };
  }; 






