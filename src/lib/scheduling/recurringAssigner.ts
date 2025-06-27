import { 
    RecurringShiftAssignment, 
    ShiftTemplate, 
    ScheduledShift, 
    ShiftAssignment,
    Worker
} from '@/lib/types';
import { ScheduleGenerationState } from './scheduleState';
import { mapDayOfWeekToDate } from './utils';
import { calculateShiftDurationHours } from './time-utils';
import { v4 as uuidv4 } from 'uuid'; 

/**
 * Processes predefined recurring assignments for a given week.
 * Creates ScheduledShift and ShiftAssignment records for valid assignments
 * that match a required ShiftTemplate and don't conflict with other recurring assignments.
 * Updates the ScheduleGenerationState.
 * 
 * @param recurringAssignments List of recurring assignments for the target location.
 * @param weekDates Array of 7 Date objects for the target week (Mon-Sun).
 * @param templates List of all required ShiftTemplates for the target location.
 * @param activeWorkers List of active workers for the target location.
 * @param state The ScheduleGenerationState object to update.
 * @returns An object containing an array of warning messages.
 */
export function processRecurringAssignments(
    recurringAssignments: RecurringShiftAssignment[],
    weekDates: Date[],
    templates: ShiftTemplate[],
    activeWorkers: Worker[],
    state: ScheduleGenerationState
): { warnings: string[] } {
    const warnings: string[] = [];

    for (const assignment of recurringAssignments) {
        let shiftDate: Date;
        try {
            // a. Determine Shift Date
            shiftDate = mapDayOfWeekToDate(assignment.day_of_week, weekDates);
        } catch (error: any) {
            warnings.push(`Error determining date for recurring assignment ID ${assignment.id}: ${error.message}`);
            continue; // Skip if date cannot be determined
        }

        // b. Conflict Check (within recurring assignments for the same day)
        if (state.isWorkerAssignedOnDate(assignment.worker_id, shiftDate)) {
            const formattedDate = shiftDate.toISOString().split('T')[0];
            warnings.push(
                `Worker ${assignment.worker_id} has conflicting recurring assignments on ${formattedDate}. Skipping assignment ID ${assignment.id}.`
            );
            continue; // Skip this conflicting assignment
        }

        // c. Find Matching Template
        const matchingTemplate = templates.find(template => {
            const isRecurringLead = assignment.assignment_type === 'lead';
            const isTemplateLead = !!template.lead_type; // True if 'opening' or 'closing'

            return (
                template.location_id === assignment.location_id &&
                template.position_id === assignment.position_id &&
                template.days_of_week.includes(assignment.day_of_week) &&
                template.start_time === assignment.start_time &&
                template.end_time === assignment.end_time &&
                isRecurringLead === isTemplateLead // Match lead-to-lead and regular-to-regular
            );
        });

        if (!matchingTemplate) {
            warnings.push(
                `Recurring assignment for worker ${assignment.worker_id} on ${assignment.day_of_week} ` +
                `(${assignment.start_time}-${assignment.end_time}) does not match any required ShiftTemplate ` +
                `at location ${assignment.location_id}. Skipping assignment ID ${assignment.id}.`
            );
            continue; // Skip assignment if no matching template found
        }

        // NEW: Add lead eligibility check
        const worker = activeWorkers.find(w => w.id === assignment.worker_id);
        if (!worker) {
            warnings.push(
                `Recurring assignment for worker ID ${assignment.worker_id} (not found in active list) could not be processed for template ${matchingTemplate.id}. Skipping.`
            );
            continue;
        }

        // Check if the template requires a lead and if the worker is eligible
        if (matchingTemplate.lead_type && !worker.is_lead) {
            warnings.push(
                `Recurring assignment for worker ${worker.first_name} ${worker.last_name} ` +
                `on ${assignment.day_of_week} matches a LEAD shift (template ${matchingTemplate.id}), ` +
                `but the worker is not a lead. Skipping assignment.`
            );
            continue;
        }

        const foundTemplateId = matchingTemplate.id;

        // d. Create ScheduledShift Object
        const newScheduledShift: ScheduledShift = {
            id: uuidv4(),
            shift_date: shiftDate.toISOString().split('T')[0], // Format YYYY-MM-DD
            template_id: foundTemplateId,
            worker_id: assignment.worker_id, // Assign worker directly as per clarification
            location_id: assignment.location_id,
            position_id: assignment.position_id,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            is_recurring_generated: true,
            created_at: new Date().toISOString(),
        };

        // e. Create ShiftAssignment Object
        const newShiftAssignment: ShiftAssignment = {
            id: uuidv4(),
            scheduled_shift_id: newScheduledShift.id,
            worker_id: assignment.worker_id,
            assignment_type: assignment.assignment_type || 'regular', // Default to regular if not specified
            is_manual_override: false,
            // assigned_start/end default to shift times unless explicitly different
            assigned_start: assignment.start_time,
            assigned_end: assignment.end_time, 
            created_at: new Date().toISOString(),
        };

        // f. Calculate Duration
        let shiftDurationHours = 0;
        try {
            shiftDurationHours = calculateShiftDurationHours(assignment.start_time, assignment.end_time);
        } catch (error: any) {
            warnings.push(`Error calculating duration for assignment ID ${assignment.id}: ${error.message}. Skipping.`);
            continue;
        }

        // g. Update State
        state.addAssignment(newScheduledShift, newShiftAssignment, foundTemplateId, shiftDurationHours);
    }

    return { warnings };
} 