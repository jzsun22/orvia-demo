import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type Database } from '@/lib/supabase/database.types';

// Define constants for paired shifts
const CEDAR_LOOP_LOCATION_ID = process.env.NEXT_PUBLIC_CEDAR_LOOP_LOCATION_ID;
const PREP_BARISTA_POSITION_ID = process.env.NEXT_PUBLIC_PREP_BARISTA_POSITION_ID;
const PAIRED_TEMPLATE_ID_1 = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_1; 
const PAIRED_TEMPLATE_ID_2 = process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_2; 

interface ShiftData {
  shift_date: string;    // YYYY-MM-DD
  template_id: string;
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
}

interface AssignmentData {
  worker_id: string;
  assignment_type: 'lead' | 'regular' | 'training';
  is_manual_override?: boolean;
  assigned_start?: string | null;
  assigned_end?: string | null;
}

interface RequestPayload {
  shiftData: ShiftData;
  assignments: AssignmentData[];
}

export async function POST(request: Request) {
  console.log('[API] Paired Shift ENV VARS:', {
    CEDAR_LOOP_LOCATION_ID: process.env.NEXT_PUBLIC_CEDAR_LOOP_LOCATION_ID,
    PREP_BARISTA_POSITION_ID: process.env.NEXT_PUBLIC_PREP_BARISTA_POSITION_ID,
    PAIRED_TEMPLATE_ID_1: process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_1,
    PAIRED_TEMPLATE_ID_2: process.env.NEXT_PUBLIC_PREP_BARISTA_TEMPLATE_2,
  });

  const supabase = await createSupabaseServerClient();

  try {
    const { shiftData, assignments }: RequestPayload = await request.json();
    console.log('[API] Received payload:', { shiftData, assignments });

    if (!shiftData || !assignments) {
      return NextResponse.json({ error: 'Missing shiftData or assignments' }, { status: 400 });
    }

    const { shift_date, template_id } = shiftData; // Original start_time, end_time from client are less reliable

    if (!shift_date || !template_id) {
      // Removed start_time and end_time check here as we'll fetch from template
      return NextResponse.json({ error: 'Missing required fields in shiftData (shift_date, template_id)' }, { status: 400 });
    }

    // Define consistent types for shift template and scheduled shift rows/inserts
    type ShiftTemplateRow = Database['public']['Tables']['shift_templates']['Row'];
    type ScheduledShiftInsert = Database['public']['Tables']['scheduled_shifts']['Insert'];
    type ScheduledShiftRow = Database['public']['Tables']['scheduled_shifts']['Row'];

    // 1. Fetch details for the primary template
    console.log(`[API] Fetching primary template with id: ${template_id}`);
    const { data: primaryTemplate, error: primaryTemplateError } = await supabase
      .from('shift_templates')
      .select('id, start_time, end_time, position_id, location_id')
      .eq('id', template_id)
      .single<ShiftTemplateRow>();

    if (primaryTemplateError || !primaryTemplate) {
      console.error('Supabase error fetching primary template:', primaryTemplateError);
      return NextResponse.json({ error: primaryTemplateError?.message || 'Failed to fetch primary shift template.' }, { status: 500 });
    }
    console.log('[API] Fetched primary template:', primaryTemplate);

    let isPairedShift = false;
    let partnerTemplateId: string | null = null;
    let partnerTemplate: ShiftTemplateRow | null = null; // Use the consistent Row type
    let scheduledShiftIdForAssignments: string;
    let createdPartnerScheduledShiftId: string | null = null;

    // Check if it's the special Prep/Barista paired shift
    console.log('[API] Checking for paired shift condition...');
    console.log(`[API] Condition (position_id): ${primaryTemplate.position_id} === ${PREP_BARISTA_POSITION_ID}`);
    console.log(`[API] Condition (location_id): ${primaryTemplate.location_id} === ${CEDAR_LOOP_LOCATION_ID}`);
    if (
      primaryTemplate.position_id === PREP_BARISTA_POSITION_ID &&
      primaryTemplate.location_id === CEDAR_LOOP_LOCATION_ID
    ) {
      console.log('[API] Paired shift conditions met. Checking template IDs.');
      console.log(`[API] Primary template ID: ${primaryTemplate.id}`);
      console.log(`[API] PAIRED_TEMPLATE_ID_1: ${PAIRED_TEMPLATE_ID_1}`);
      console.log(`[API] PAIRED_TEMPLATE_ID_2: ${PAIRED_TEMPLATE_ID_2}`);
      if (primaryTemplate.id === PAIRED_TEMPLATE_ID_1) {
        partnerTemplateId = PAIRED_TEMPLATE_ID_2 ?? null;
      } else if (primaryTemplate.id === PAIRED_TEMPLATE_ID_2) {
        partnerTemplateId = PAIRED_TEMPLATE_ID_1 ?? null;
      }

      console.log(`[API] Determined partnerTemplateId: ${partnerTemplateId}`);

      if (partnerTemplateId) {
        const { data: fetchedPartnerTemplate, error: partnerTemplateError }  = await supabase
          .from('shift_templates')
          .select('id, start_time, end_time, position_id, location_id')
          .eq('id', partnerTemplateId)
          .single<ShiftTemplateRow>();

        if (partnerTemplateError || !fetchedPartnerTemplate) {
          console.warn(`Paired shift detected, but partner template ${partnerTemplateId} not found. Proceeding as non-paired.`, partnerTemplateError);
          // Proceed as if not a paired shift if partner template is missing
        } else if (
            fetchedPartnerTemplate.position_id === PREP_BARISTA_POSITION_ID &&
            fetchedPartnerTemplate.location_id === CEDAR_LOOP_LOCATION_ID
        ) {
          isPairedShift = true;
          partnerTemplate = fetchedPartnerTemplate;
          console.log('[API] Partner template validated. isPairedShift is now true.');
        } else {
            console.warn(`Paired shift detected, but partner template ${partnerTemplateId} does not match Prep Barista/Cupertino criteria. Proceeding as non-paired.`);
        }
      }
    } else {
      console.log('[API] Paired shift conditions NOT met.');
    }

    // 2. Create the scheduled shift(s)
    console.log(`[API] Proceeding to create shift(s). Is this a paired shift? ${isPairedShift}`);
    if (isPairedShift && partnerTemplate) {
      // Create first part of the pair (using primaryTemplate)
      const shift1ToInsert: ScheduledShiftInsert = {
        shift_date,
        template_id: primaryTemplate.id,
        start_time: primaryTemplate.start_time,
        end_time: primaryTemplate.end_time,
        is_recurring_generated: false,
      };
      const { data: newScheduledShift1, error: shiftError1 } = await supabase
        .from('scheduled_shifts')
        .insert(shift1ToInsert as any)
        .select('id')
        .single<ScheduledShiftRow>();

      if (shiftError1 || !newScheduledShift1) {
        console.error('Supabase error creating first part of paired scheduled_shift:', shiftError1);
        return NextResponse.json({ error: shiftError1?.message || 'Failed to create first part of paired shift.' }, { status: 500 });
      }
      scheduledShiftIdForAssignments = newScheduledShift1.id;

      // Create second part of the pair (using partnerTemplate)
      const shift2ToInsert: ScheduledShiftInsert = {
        shift_date,
        template_id: partnerTemplate.id,
        start_time: partnerTemplate.start_time,
        end_time: partnerTemplate.end_time,
        is_recurring_generated: false,
      };
      const { data: newScheduledShift2, error: shiftError2 } = await supabase
        .from('scheduled_shifts')
        .insert(shift2ToInsert as any)
        .select('id')
        .single<ScheduledShiftRow>();
      
      if (shiftError2 || !newScheduledShift2) {
        console.error('Supabase error creating second part of paired scheduled_shift:', shiftError2);
        // Attempt to clean up the first created shift part
        await supabase.from('scheduled_shifts').delete().eq('id', scheduledShiftIdForAssignments);
        return NextResponse.json({ error: shiftError2?.message || 'Failed to create second part of paired shift. First part rolled back.' }, { status: 500 });
      }
      createdPartnerScheduledShiftId = newScheduledShift2.id; // For logging or return if needed
      console.log(`Created paired shifts: ${scheduledShiftIdForAssignments} (Primary) and ${createdPartnerScheduledShiftId} (Partner)`);

    } else { // Not a paired shift or failed to validate partner
      const shiftToInsert: ScheduledShiftInsert = {
        shift_date,
        template_id: primaryTemplate.id, // Use the fetched primary template ID
        start_time: primaryTemplate.start_time, // Use authoritative start time
        end_time: primaryTemplate.end_time,   // Use authoritative end time
        is_recurring_generated: false,
      };
      const { data: newScheduledShift, error: shiftError } = await supabase
        .from('scheduled_shifts')
        .insert(shiftToInsert as any)
        .select('id')
        .single<ScheduledShiftRow>();

      if (shiftError || !newScheduledShift) {
        console.error('Supabase error creating scheduled_shift:', shiftError);
        const message = shiftError?.message || 'Failed to create shift, no data returned from database.';
        return NextResponse.json({ error: message }, { status: 500 });
      }
      scheduledShiftIdForAssignments = newScheduledShift.id;
      console.log(`[API] Created single shift: ${scheduledShiftIdForAssignments}`);
    }

    const createdAssignmentResults = [];

    // 3. Create shift assignments for all relevant shifts.
    if (assignments.length > 0) {
      const assignmentPromises = [];

      // Determine all shift IDs that need assignments.
      const shiftIdsToAssign = [scheduledShiftIdForAssignments];
      if (isPairedShift && createdPartnerScheduledShiftId) {
        shiftIdsToAssign.push(createdPartnerScheduledShiftId);
      }

      // Create assignments for each worker for each required shift.
      for (const asm of assignments) {
        for (const shiftId of shiftIdsToAssign) {
          const payload = {
            scheduledShiftId: shiftId,
            newWorkerId: asm.worker_id,
            newAssignmentType: asm.assignment_type,
            newAssignedStart: asm.assigned_start || null,
            newAssignedEnd: asm.assigned_end || null,
          };
          assignmentPromises.push(
            supabase.functions.invoke('add-shift-assignment', { body: payload })
          );
        }
      }

      const assignmentResponses = await Promise.all(assignmentPromises);

      // Check for errors and perform rollback if any occurred.
      const failedResponse = assignmentResponses.find(res => res.error);
      if (failedResponse && failedResponse.error) {
        console.error(`[API ROUTE] Error invoking 'add-shift-assignment':`, JSON.stringify(failedResponse.error, null, 2));
        
        // Full rollback logic: remove assignments and shifts.
        const allShiftIds = [scheduledShiftIdForAssignments, createdPartnerScheduledShiftId].filter((id): id is string => !!id);
        if (allShiftIds.length > 0) {
          await supabase.from('shift_assignments').delete().in('scheduled_shift_id', allShiftIds);
          await supabase.from('scheduled_shifts').delete().in('id', allShiftIds);
        }

        return NextResponse.json({
          error: `Failed to add one or more assignments via Edge Function. Shift creation has been rolled back.`,
          details: failedResponse.error,
        }, { status: 500 });
      }

      createdAssignmentResults.push(...assignmentResponses.map(res => res.data));
    }

    return NextResponse.json({
      message: 'Shift created and assignments processed successfully.',
      scheduledShiftId: scheduledShiftIdForAssignments,
      partnerScheduledShiftId: createdPartnerScheduledShiftId, // Include if created
      assignmentResults: createdAssignmentResults,
    }, { status: 201 });

  } catch (error: any) {
    console.error('API error in create-shift-with-assignments (during Edge Function invocation flow):', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
} 