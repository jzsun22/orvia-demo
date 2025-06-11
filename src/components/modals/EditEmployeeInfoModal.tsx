'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { JobLevel } from '@/lib/types';
import { useAppToast } from "@/lib/toast-service";
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';

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
  const { showSuccessToast } = useAppToast();
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
        birthday: employee.birthday ? new Date(`${employee.birthday}T00:00:00`) : undefined,
        preferred_hours_per_week: employee.preferred_hours_per_week?.toString() ?? '',
        inactive: employee.inactive !== true,
      });
    }
  }, [isOpen, employee, reset]);

  const onSubmit: SubmitHandler<EmployeeInfoFormData> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      // Create an object with only the fields to update on the workers table
      const workerUpdateData = {
        first_name: data.first_name,
        last_name: data.last_name,
        preferred_name: data.preferred_name || null,
        job_level: data.job_level,
        gender: data.gender,
        birthday: data.birthday ? format(data.birthday, 'yyyy-MM-dd') : null,
        preferred_hours_per_week: data.preferred_hours_per_week ?? null,
        inactive: data.inactive ? null : true,
      };

      // Update worker
      const { error: workerError } = await supabase
        .from('workers')
        .update(workerUpdateData)
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
    setShowDeleteDialog(true);
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
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md bg-[#f8f9f7]">
          <DialogHeader>
            <DialogTitle className="text-xl font-manrope font-semibold">Edit Personal Information</DialogTitle>
          </DialogHeader>
          {error && <p className="text-sm text-red-500 text-center mb-4">Error: {error}</p>}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" {...register('first_name')} className={errors.first_name ? 'border-red-500' : ''} />
                {errors.first_name && <p className="text-sm text-red-500">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" {...register('last_name')} className={errors.last_name ? 'border-red-500' : ''} />
                {errors.last_name && <p className="text-sm text-red-500">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_name">Nickname (optional)</Label>
              <Input id="preferred_name" {...register('preferred_name')} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                            <Select
                                onValueChange={field.onChange}
                                value={field.value ?? ''}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GENDERS.map((gender) => (
                                        <SelectItem key={gender} value={gender}>
                                            {gender.charAt(0).toUpperCase() + gender.slice(1).replace('_', ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="birthday">Birthday</Label>
                    <Controller
                        name="birthday"
                        control={control}
                        render={({ field }) => (
                            <Input
                                id="birthday"
                                type="date"
                                className={errors.birthday ? 'border-red-500' : ''}
                                {...field}
                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            />
                        )}
                    />
                    {errors.birthday && <p className="text-sm text-red-500">{errors.birthday.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_hours_per_week">Preferred hours per week (optional)</Label>
              <Input
                id="preferred_hours_per_week"
                type="number"
                min="0"
                max="40"
                {...register('preferred_hours_per_week')}
                className={errors.preferred_hours_per_week ? 'border-red-500' : ''}
              />
              {errors.preferred_hours_per_week && (
                <p className="text-sm text-red-500">{errors.preferred_hours_per_week.message}</p>
              )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="job_level">Job Level</Label>
                <Controller
                    name="job_level"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a job level" />
                            </SelectTrigger>
                            <SelectContent>
                                {JOB_LEVELS.map((level) => (
                                <SelectItem key={level} value={level}>
                                    {level}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.job_level && <p className="text-sm text-red-500">{errors.job_level.message}</p>}
            </div>

            <Controller
              name="inactive"
              control={control}
              render={({ field }) => (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="active_status" className="text-base">Worker Status</Label>
                  <div className="flex items-center space-x-3 p-3 border rounded-md bg-background">
                    <Switch
                      id="active_status"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <Label htmlFor="active_status" className="font-normal text-sm cursor-pointer">
                      {field.value ? 'Active' : 'Inactive'}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    Inactive workers are excluded from scheduling.
                  </p>
                </div>
              )}
            />

            <div className="flex justify-between items-center border-t border-border pt-6 mt-6">
              <Button type="button" variant="destructive" onClick={handleDeleteClick} disabled={loading}>
                Delete Employee
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
    </>
  );
} 