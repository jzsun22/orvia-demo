'use client'

import useSWR from 'swr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { startOfWeek, endOfWeek, format as formatFn, parseISO, isToday } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { supabase } from '@/lib/supabase/client'
import {
  fetchAllLocations,
  fetchScheduledShifts,
  fetchShiftTemplates,
  fetchWorkers,
  type ScheduledShiftWithJoins,
} from '@/lib/supabase'

const APP_TIMEZONE = 'America/Los_Angeles';

// Fetch all workers with birthday field for dashboard birthday logic
export const fetchWorkersWithBirthday = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from('workers')
    .select('id, first_name, last_name, preferred_name, birthday')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) {
    console.error('Error fetching workers with birthday:', error.message)
    throw error
  }

  return data || []
}

// Fetch birthdays for the dashboard
export const birthdayFetcher = async (client: SupabaseClient) => {
  const allWorkers = await fetchWorkersWithBirthday(client)
  const today = toZonedTime(new Date(), APP_TIMEZONE);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  // Filter workers whose birthday (month/day) falls within this week
  const birthdaysThisWeek = (allWorkers || [])
    .filter((worker: any) => {
      if (!worker.birthday) return false
      // worker.birthday is a 'YYYY-MM-DD' string. We treat it as a UTC date.
      const birthdayDate = parseISO(worker.birthday);
      
      // Construct the birthday for the current year in the correct timezone.
      const thisYearBirthday = toZonedTime(
        `${today.getFullYear()}-${formatFn(birthdayDate, 'MM-dd')}`,
        APP_TIMEZONE
      );
      
      return thisYearBirthday >= weekStart && thisYearBirthday <= weekEnd
    })
    .map((worker: any) => {
      const birthdayDate = parseISO(worker.birthday);
      const thisYearBirthday = toZonedTime(
        `${today.getFullYear()}-${formatFn(birthdayDate, 'MM-dd')}`,
        APP_TIMEZONE
      );

      return {
        ...worker,
        birthdayThisYear: thisYearBirthday,
        isToday: isToday(thisYearBirthday),
        dayOfWeek: formatFn(thisYearBirthday, 'EEEE'),
      }
    })

  // Sort: today first, then by day of week
  birthdaysThisWeek.sort((a: any, b: any) => {
    if (a.isToday) return -1
    if (b.isToday) return 1
    return a.birthdayThisYear.getTime() - b.birthdayThisYear.getTime()
  })

  return birthdaysThisWeek
}

// Fetch staff stats for the dashboard
export const staffStatsFetcher = async (client: SupabaseClient) => {
  const allLocations = await fetchAllLocations(client)
  const today = toZonedTime(new Date(), APP_TIMEZONE);
  const weekStart = formatFn(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = formatFn(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // For each location, gather stats
  const stats = await Promise.all(
    allLocations.map(async (location: any) => {
      // Fetch scheduled shifts for the week
      const scheduledShifts: ScheduledShiftWithJoins[] =
        await fetchScheduledShifts(client, location.id, weekStart, weekEnd)
      // Fetch required shift templates for the location
      const shiftTemplates = await fetchShiftTemplates(client, location.id)

      // Calculate required shifts, counting shifts with the same schedule_column_group on the same day as one.
      const dailyRequired = new Map<string, Set<string | number>>()
      shiftTemplates.forEach((template: any) => {
        if (Array.isArray(template.days_of_week)) {
          template.days_of_week.forEach((day: string) => {
            // Guard against bad data and sanitize day string
            if (typeof day !== 'string') return;
            const cleanDay = day.trim().toLowerCase();

            if (!dailyRequired.has(cleanDay)) {
              dailyRequired.set(cleanDay, new Set())
            }
            const daySet = dailyRequired.get(cleanDay)!

            // Use != null to handle both null and undefined for schedule_column_group
            if (template.schedule_column_group != null) {
              daySet.add(template.schedule_column_group)
            } else {
              // For templates without a group, count them individually using a unique identifier
              daySet.add(template.id)
            }
          })
        }
      })

      let requiredShifts = 0
      for (const daySet of Array.from(dailyRequired.values())) {
        requiredShifts += daySet.size
      }

      // Count filled shifts based on 'regular' and 'lead' assignment types
      const filledShifts = scheduledShifts.reduce((count, shift) => {
        if (shift.shift_assignments && Array.isArray(shift.shift_assignments)) {
          const validAssignments = shift.shift_assignments.filter(
            (assignment) =>
              assignment.assignment_type === 'regular' ||
              assignment.assignment_type === 'lead'
          ).length
          return count + validAssignments
        }
        return count
      }, 0)
      
      // Fetch all active workers for this location
      const allWorkers = await fetchWorkers(client)
      const activeWorkers = allWorkers.filter(
        (w: any) =>
          !w.inactive &&
          w.locations &&
          w.locations.some((l: any) => l.location && l.location.id === location.id)
      )
      // Unique scheduled workers
      const uniqueScheduledWorkerIds = new Set(
        scheduledShifts
          .filter((shift: any) => shift.worker_id)
          .map((shift: any) => shift.worker_id)
      )
      return {
        locationId: location.id,
        locationName: location.name,
        percentFilled:
          requiredShifts === 0
            ? 0
            : Math.round((filledShifts / requiredShifts) * 100),
        filledShifts,
        requiredShifts,
        uniqueScheduled: uniqueScheduledWorkerIds.size,
        activeWorkers: activeWorkers.length,
      }
    })
  )
  return stats
}

// Fetch dashboard data for locations and today's scheduled workers
export const dashboardFetcher = async (
  client: SupabaseClient
): Promise<
  { location_id: string; location_name: string; workersToday?: string[] }[]
> => {
  const allLocations = await fetchAllLocations(client)
  if (!allLocations || allLocations.length === 0) {
    return []
  }

  const today = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
  const { data: todaysScheduledData, error: shiftsError } = await client
    .from('scheduled_shifts')
    .select(
      `
      shift_date,
      shift_templates!inner (
        location_id,
        locations!inner (id, name)
      ),
      shift_assignments!inner (
        workers!inner (id, first_name, last_name, preferred_name)
      )
    `
    )
    .eq('shift_date', today)

  if (shiftsError) {
    console.error("Error fetching today's scheduled shifts:", shiftsError)
    throw shiftsError
  }

  const workersGroupedByLocation: Record<string, Set<string>> = {}

  if (todaysScheduledData) {
    todaysScheduledData.forEach((shift: any) => {
      if (shift.shift_templates && shift.shift_templates.locations) {
        const locationId = shift.shift_templates.locations.id
        if (!workersGroupedByLocation[locationId]) {
          workersGroupedByLocation[locationId] = new Set()
        }
        if (Array.isArray(shift.shift_assignments)) {
          shift.shift_assignments.forEach((assignment: any) => {
            if (assignment.workers) {
              const worker = assignment.workers
              const workerName = worker.preferred_name || worker.first_name
              if (workerName) {
                workersGroupedByLocation[locationId].add(workerName)
              }
            }
          })
        }
      }
    })
  }

  const locationData = allLocations.map(location => ({
    location_id: location.id,
    location_name: location.name,
    workersToday: workersGroupedByLocation[location.id]
      ? Array.from(workersGroupedByLocation[location.id]).sort()
      : [],
  }))

  return locationData
}

export function useDashboardData() {
  const {
    data: locations,
    error,
    isLoading: locationsLoading,
  } = useSWR('dashboardData', () => dashboardFetcher(supabase))
  const { data: birthdays, isLoading: birthdaysLoading } = useSWR(
    'dashboardBirthdays',
    () => birthdayFetcher(supabase)
  )
  const { data: staffStats, isLoading: staffStatsLoading } = useSWR(
    'dashboardStaffStats',
    () => staffStatsFetcher(supabase)
  )

  return {
    locations,
    birthdays,
    staffStats,
    error,
    isLoading: locationsLoading || birthdaysLoading || staffStatsLoading,
    locationsLoading,
    birthdaysLoading,
    staffStatsLoading,
  }
} 