'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { employeeInfoSchema, type EmployeeInfoFormData } from '@/lib/schemas/employee';
import { supabase } from '@/lib/supabase/client';
import type { TablesUpdate } from '@/lib/supabase/database.types';
import { JobLevel } from '@/lib/types';
import { useAppToast } from "@/lib/toast-service";
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import {
  DatePicker,
  Dialog,
  Heading,
  Popover,
  Modal,
  ModalOverlay,
  Group,
  Button as ButtonRAC,
} from "react-aria-components";
import { Calendar } from '@/components/ui/calendar-rac'
import { DateInput } from '@/components/ui/datefield-rac'
import { parseDate } from "@internationalized/date";

interface ExtendedWorker {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  gender: 'male' | 'female' | 'non-binary' | null;
  birthday: string | null; // Stored as ISO date string
  job_level: JobLevel;
  preferred_hours_per_week: number | null;
  inactive?: boolean | null;
}

interface EditEmployeeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee: ExtendedWorker;
}

const JOB_LEVELS: JobLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
const GENDERS: ('male' | 'female' | 'non-binary')[] = ['male', 'female', 'non-binary'];

export function EditEmployeeInfoModal({ isOpen, onClose, onSuccess, employee }: EditEmployeeInfoModalProps) {
  const { showSuccessToast, showInfoToast } = useAppToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control
  } = useForm({
    resolver: zodResolver(employeeInfoSchema),
  });

  // Effect to reset form when modal opens or employee data changes
  useEffect(() => {
    if (isOpen && employee) {
      reset({
        first_name: employee.first_name,
        last_name: employee.last_name,
        preferred_name: employee.preferred_name || '',
        job_level: employee.job_level,
        gender: employee.gender ?? undefined,
        birthday: employee.birthday ? parseDate(employee.birthday) : undefined,
        preferred_hours_per_week: employee.preferred_hours_per_week ?? null,
        inactive: employee.inactive !== true,
      });
    }
  }, [isOpen, employee, reset]);

  const onSubmit: SubmitHandler<EmployeeInfoFormData> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      // Create an object with only the fields to update on the workers table
      const workerUpdateData: TablesUpdate<'workers'> = {
        first_name: data.first_name,
        last_name: data.last_name,
        preferred_name: data.preferred_name || null,
        job_level: data.job_level,
        gender: data.gender,
        birthday: data.birthday ? data.birthday.toString() : null,
        preferred_hours_per_week: data.preferred_hours_per_week ?? null,
        inactive: data.inactive ? null : true,
      };

      // Update worker
      const { error: workerError } = await supabase
      // Cast required due to Supabase update typings resolving to never after library upgrade.
        .from('workers')
        .update(workerUpdateData as never)
        .eq('id', employee.id);

      if (workerError) throw workerError;

      showSuccessToast(`Employee ${data.first_name} ${data.last_name}'s details updated.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error updating employee info:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    // For demo purposes, we skip the confirmation dialog and show a toast directly.
    showInfoToast('Employee deletion is disabled here to keep the demo functional for everyone. Gotta keep the place intact :)');
    // Original implementation:
    // setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      // Delete associations first
      await supabase.from('worker_positions').delete().eq('worker_id', employee.id);
      await supabase.from('worker_locations').delete().eq('worker_id', employee.id);
      await supabase.from('recurring_shift_assignments').delete().eq('worker_id', employee.id);
      await supabase.from('shift_assignments').delete().eq('worker_id', employee.id);


      // Delete worker
      const { error: workerError } = await supabase
        .from('workers')
        .delete()
        .eq('id', employee.id);

      if (workerError) throw workerError;

      showSuccessToast(`Employee ${employee.first_name} ${employee.last_name} deleted successfully.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      isDismissable={true}
    >
      <ModalOverlay className="fixed inset-0 z-50 bg-[rgb(40,30,22)]/[0.22] backdrop-blur-sm data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0" />
      <Dialog className="my-modal-shadow fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-0 border-[1.5px] border-verylightbeige data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:slide-in-from-bottom-4 data-[entering]:zoom-in-95 data-[exiting]:slide-out-to-bottom-4 data-[exiting]:zoom-out-95 overflow-hidden">
        <div className="custom-scrollbar max-h-[380px] p-8 2xl:p-6 xl:max-h-[600px] 2xl:max-h-full overflow-y-auto">
          <Heading
            className="text-lg 2xl:text-xl font-manrope font-medium mb-4">Edit Personal Information
          </Heading>
          {error && <p className="text-sm text-errorred text-center mb-4">Error: {error}</p>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" {...register('first_name')} className={cn("border border-input bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none", errors.first_name ? 'border-errorred' : '')} />
                {errors.first_name && <p className="text-sm text-errorred">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" {...register('last_name')} className={cn("border border-input focus-visible:ring-1 focus-visible:ring-offset-0 transition-none bg-white shadow-none", errors.last_name ? 'border-errorred' : '')} />
                {errors.last_name && <p className="text-sm text-errorred">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferred_name">Preferred Name</Label>
                <Input
                  id="preferred_name" {...register('preferred_name')}
                  className="border border-input focus-visible:ring-1 focus-visible:ring-offset-0 transition-none shadow-none"
                  placeholder="optional" />
              </div>


              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <Select
                      key={field.value}
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <SelectTrigger className="data-[placeholder]:text-muted-foreground/80 shadow-none text-sm font-normal">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} className="text-sm">
                        {GENDERS.map((gender) => (
                          <SelectItem key={gender} value={gender} className="hover:bg-accent/50">
                            {gender.charAt(0).toUpperCase() + gender.slice(1).replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday</Label>
                <Controller
                  name="birthday"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      granularity="day"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      className="*:not-first:mt-2"
                    >
                      <div className="flex">
                        <Group className="w-full">
                          <DateInput className="pe-9 !bg-white focus-visible:ring-1 focus-visible:ring-offset-0 transition-none hover:ring-1 hover:ring-roseblush" />
                        </Group>
                        <ButtonRAC type="button" className="text-muted-foreground/80 hover:text-muted-foreground data-focus-visible:border-ring data-focus-visible:ring-ring/50 z-10 -ms-9 -me-px flex w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none data-focus-visible:ring-[3px]">
                          <CalendarIcon size={16} />
                        </ButtonRAC>
                      </div>
                      <Modal>
                        <Popover
                          className="!bg-white text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-[60] rounded-lg border shadow-lg outline-hidden"
                          offset={4}
                        >
                          <Dialog className="max-h-[inherit] overflow-auto p-2">
                            <Calendar />
                          </Dialog>
                        </Popover>
                      </Modal>
                    </DatePicker>
                  )}
                />
                {errors.birthday && <p className="text-sm text-errorred">{errors.birthday.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_level">Job Level</Label>
                <Controller
                  name="job_level"
                  control={control}
                  render={({ field }) => (
                    <Select
                      key={field.value}
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job level" className="data-[placeholder]:text-muted-foreground/80 shadow-none text-sm font-normal" />
                      </SelectTrigger>
                      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} className="text-sm">
                        {JOB_LEVELS.map((level) => (
                          <SelectItem key={level} value={level} className="hover:bg-accent/50">
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.job_level && <p className="text-sm text-errorred">{errors.job_level.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_hours_per_week">Preferred hours per week</Label>
                <Input
                  id="preferred_hours_per_week"
                  placeholder="optional"
                  type="number"
                  min="0"
                  max="40"
                  {...register('preferred_hours_per_week')}
                  className={cn("border border-input focus-visible:ring-1 focus-visible:ring-offset-0 transition-none !bg-white placeholder:text-muted-foreground/80 shadow-none", errors.preferred_hours_per_week ? 'border-errorred' : '', 'bg-background')}
                />
                {errors.preferred_hours_per_week && (
                  <p className="text-sm text-errorred">{errors.preferred_hours_per_week.message}</p>
                )}
              </div>
            </div>


            <Controller
              name="inactive"
              control={control}
              render={({ field }) => (
                <div className="flex items-end justify-between pt-4">
                  <div className="space-y-1">
                    <Label className="font-medium">
                      Worker Status
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive workers are excluded from scheduling.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active_status"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <Label htmlFor="active_status" className="w-12 text-xs">
                      {field.value ? 'Active' : 'Inactive'}
                    </Label>
                  </div>
                </div>
              )}
            />


            <div className="flex justify-between items-center pt-6 mt-6">
              <Button type="button" variant="destructive" onClick={handleDeleteClick} disabled={loading}>
                Delete Employee
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className='bg-deeproseblush hover:bg-deeproseblush/80'>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {employee.first_name} {employee.last_name}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteConfirm} disabled={loading}>
                    {loading ? 'Deleting...' : 'Yes, delete employee'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </form>
        </div>
      </Dialog>
    </Modal>
  );
} 


