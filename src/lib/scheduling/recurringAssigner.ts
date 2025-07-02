import { 
    RecurringShiftAssignment, 
    ShiftTemplate, 
    ScheduledShift, 
    ShiftAssignment,
    Worker
} from '@/lib/types';
import { ScheduleGenerationState } from './scheduleState';
import { mapDayOfWeekToDate, calculateShiftDurationHours } from './utils';
import { v4 as uuidv4 } from 'uuid'; 

const PREP_BARISTA_TEMPLATE_1_ID = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_1;
const PREP_BARISTA_TEMPLATE_2_ID = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_2;

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
    const processedPairedAssignments = new Set<string>(); // Keep track of partner assignments already handled

    for (const assignment of recurringAssignments) {
        if (processedPairedAssignments.has(assignment.id)) {
            continue; // Skip if this was already processed as a partner
        }
        
        let shiftDate: Date;
        try {
            shiftDate = mapDayOfWeekToDate(assignment.day_of_week, weekDates);
        } catch (error: any) {
            warnings.push(`Error determining date for recurring assignment ID ${assignment.id}: ${error.message}`);
            continue;
        }

        if (state.isWorkerAssignedOnDate(assignment.worker_id, shiftDate)) {
            const formattedDate = shiftDate.toISOString().split('T')[0];
            warnings.push(`Worker ${assignment.worker_id} has conflicting recurring assignments on ${formattedDate}. Skipping assignment ID ${assignment.id}.`);
            continue;
        }

        const matchingTemplate = templates.find(template => {
            const isRecurringLead = assignment.assignment_type === 'lead';
            const isTemplateLead = !!template.lead_type;
            return (
                template.location_id === assignment.location_id &&
                template.position_id === assignment.position_id &&
                template.days_of_week.includes(assignment.day_of_week) &&
                template.start_time === assignment.start_time &&
                template.end_time === assignment.end_time &&
                isRecurringLead === isTemplateLead
            );
        });

        if (!matchingTemplate) {
            warnings.push(`Recurring assignment for worker ${assignment.worker_id} on ${assignment.day_of_week} does not match any required template. Skipping.`);
            continue;
        }

        const worker = activeWorkers.find(w => w.id === assignment.worker_id);
        if (!worker) {
            warnings.push(`Recurring assignment for worker ID ${assignment.worker_id} (not active) could not be processed. Skipping.`);
            continue;
        }

        if (matchingTemplate.lead_type && !worker.is_lead) {
            warnings.push(`Recurring assignment for ${worker.first_name} on ${assignment.day_of_week} matches a LEAD shift, but worker is not a lead. Skipping.`);
            continue;
        }
        
        // --- Logic for Paired Prep+Barista Shift ---
        const isPairedShift = matchingTemplate.id === PREP_BARISTA_TEMPLATE_1_ID || matchingTemplate.id === PREP_BARISTA_TEMPLATE_2_ID;

        if (isPairedShift) {
            const partnerTemplateId = matchingTemplate.id === PREP_BARISTA_TEMPLATE_1_ID ? PREP_BARISTA_TEMPLATE_2_ID : PREP_BARISTA_TEMPLATE_1_ID;
            const partnerTemplate = templates.find(t => t.id === partnerTemplateId);
            
            if (partnerTemplate) {
                // A recurring assignment for one half of a paired shift should create both shifts.
                
                // Find if a partner recurring assignment exists to mark it as processed and prevent double-counting
                const partnerRecurringAssignment = recurringAssignments.find(ra => 
                    ra.id !== assignment.id &&
                    ra.worker_id === assignment.worker_id &&
                    ra.day_of_week === assignment.day_of_week &&
                    ra.position_id === partnerTemplate?.position_id &&
                    ra.start_time === partnerTemplate?.start_time &&
                    ra.end_time === partnerTemplate?.end_time
                );
                if (partnerRecurringAssignment) {
                    processedPairedAssignments.add(partnerRecurringAssignment.id);
                }

                const shiftsToCreate = [
                    { template: matchingTemplate, recurring: assignment },
                    { template: partnerTemplate, recurring: assignment } // Use original recurring data for worker info
                ];

                for (const { template, recurring } of shiftsToCreate) {
                    const shift = createScheduledShiftObject(template, recurring, shiftDate);
                    const assign = createShiftAssignmentObject(shift, recurring, template); // Pass template for times
                    const duration = calculateShiftDurationHours(shift.start_time, shift.end_time);
                    state.addAssignment(shift, assign, template.id, duration);
                }
                
                continue; // Move to the next assignment in the main loop
            }
        }
        
        // --- Standard Logic for non-paired or single recurring shifts ---
        const newScheduledShift = createScheduledShiftObject(matchingTemplate, assignment, shiftDate);
        const newShiftAssignment = createShiftAssignmentObject(newScheduledShift, assignment, matchingTemplate);
        const shiftDurationHours = calculateShiftDurationHours(assignment.start_time, assignment.end_time);
        state.addAssignment(newScheduledShift, newShiftAssignment, matchingTemplate.id, shiftDurationHours);
    }

    return { warnings };
}

// Helper function to create a ScheduledShift object
function createScheduledShiftObject(template: ShiftTemplate, recurring: RecurringShiftAssignment, date: Date): ScheduledShift {
    return {
        id: uuidv4(),
        shift_date: date.toISOString().split('T')[0],
        template_id: template.id,
        worker_id: recurring.worker_id,
        location_id: recurring.location_id,
        position_id: recurring.position_id,
        // Use the template's time, not the recurring assignment's, to handle the partner case
        start_time: template.start_time, 
        end_time: template.end_time,
        is_recurring_generated: true,
        created_at: new Date().toISOString(),
    };
}

// Helper function to create a ShiftAssignment object
function createShiftAssignmentObject(shift: ScheduledShift, recurring: RecurringShiftAssignment, template: ShiftTemplate): ShiftAssignment {
    return {
        id: uuidv4(),
        scheduled_shift_id: shift.id,
        worker_id: recurring.worker_id,
        assignment_type: recurring.assignment_type || 'regular',
        is_manual_override: false,
        // Use the template's time here as well for consistency
        assigned_start: template.start_time,
        assigned_end: template.end_time,
        created_at: new Date().toISOString(),
    };
} 