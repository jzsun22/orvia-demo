import { z } from 'zod';
import { JobLevel } from '@/lib/types';
import { CalendarDate } from '@internationalized/date';

export const employeeInfoSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  preferred_name: z.string().trim().optional(),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
  birthday: z
    .custom<CalendarDate>((val) => val instanceof CalendarDate, 'Invalid date format')
    .optional()
    .nullable(),
  job_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as [JobLevel, ...JobLevel[]]),
  preferred_hours_per_week: z
    .preprocess(
      (val) => (val === '' || val == null ? undefined : val),
      z.coerce
        .number({
          invalid_type_error: 'Preferred hours must be a number.',
        })
        .int({ message: 'Preferred hours must be a whole number.' })
        .positive({ message: 'Preferred hours must be a positive number.' })
        .optional()
    )
    .nullable(),
  inactive: z.boolean(),
});

export const workSettingsSchema = z.object({
  is_lead: z.boolean(),
  positions: z.array(z.string()).min(1, 'At least one position is required'),
  location_ids: z.array(z.string()).min(1, 'At least one location is required'),
});

export const employeeSchema = employeeInfoSchema.merge(workSettingsSchema);

export type EmployeeInfoFormData = z.infer<typeof employeeInfoSchema>;
export type WorkSettingsFormData = z.infer<typeof workSettingsSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>; 