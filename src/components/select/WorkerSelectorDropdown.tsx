'use client'

import { useEffect, useState, RefObject } from 'react'
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils" 
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Worker, JobLevel } from '@/lib/types' 
import useEligibleWorkers, { EligibleWorkerResponseItem } from '@/hooks/useEligibleWorkers';

// Define NewShiftClientContext here or import from a shared location
interface NewShiftClientContext {
  templateId: string;
  shiftDate: string;    // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
}

interface WorkerSelectorDropdownProps {
  scheduledShiftId: string | null 
  newShiftClientContext?: NewShiftClientContext | null; // Added for new shift context
  targetAssignmentType: 'lead' | 'regular' | 'training'
  currentWorkerId?: string | null
  onWorkerSelect: (worker: Worker | null) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  popoverContainerRef?: RefObject<HTMLDivElement>;
  excludeWorkerId?: string | null;
}

const formatWorkerName = (worker: { first_name: string | null, last_name: string | null, preferred_name: string | null }): string => {
  const firstName = worker.first_name || '';
  const lastName = worker.last_name || '';
  if (worker.preferred_name && worker.preferred_name.trim() !== '') {
    return `${firstName} (${worker.preferred_name}) ${lastName}`.trim().replace(/\s+/g, ' ');
  }
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
};

export function WorkerSelectorDropdown({
  scheduledShiftId,
  newShiftClientContext,
  targetAssignmentType,
  currentWorkerId,
  onWorkerSelect,
  disabled = false,
  className,
  placeholder,
  popoverContainerRef,
  excludeWorkerId
}: WorkerSelectorDropdownProps) {
  // Use SWR hook for eligible workers
  const { data: eligibleWorkers, isLoading, error } = useEligibleWorkers({
    scheduledShiftId,
    newShiftClientContext,
    targetAssignmentType,
    excludeWorkerId,
    enabled: !disabled && !!scheduledShiftId,
  });
  const [open, setOpen] = useState(false)

  const handleSelect = (selectedWorkerId: string | null) => {
    if (!selectedWorkerId || selectedWorkerId === "__unassign__") {
      onWorkerSelect(null);
    } else {
      const worker = eligibleWorkers.find(w => w.id === selectedWorkerId)
      if (worker) {
        onWorkerSelect({ 
          id: worker.id, 
          first_name: worker.first_name, 
          last_name: worker.last_name,
          preferred_name: worker.preferred_name,
          job_level: worker.job_level,
          is_lead: false, // Assuming a default, this might need to be fetched if relevant
          availability: {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
          }, 
          preferred_hours_per_week: null, // Assuming a default
          birthday: null, // Added to satisfy Worker type
          created_at: new Date().toISOString(), 
        } as Worker);
      }
    }
    setOpen(false)
  }

  const currentSelectedWorkerDetails = currentWorkerId 
    ? eligibleWorkers.find(worker => worker.id === currentWorkerId) 
    : null;
  
  const displayValue = currentSelectedWorkerDetails
    ? formatWorkerName(currentSelectedWorkerDetails)
    : (placeholder || `Select ${targetAssignmentType}...`);

  if (isLoading && !open) {
    return (
      <Button variant="outline" className={cn("w-full justify-start font-normal", className)} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading {targetAssignmentType}s...
      </Button>
    )
  }

  if (error && !open) {
    return <p className={cn("text-errorred text-xs h-10 flex items-center", className)}>Error: {error.message || error.toString()}</p>
  }

  return (
    <>
      <Popover open={open} onOpenChange={(newOpenState) => {
        setOpen(newOpenState);
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline-static"
            role="combobox"
            aria-expanded={open}
            aria-label={displayValue}
            className={cn(
              "w-full justify-between hover:!bg-white border-input hover:ring-1 hover:ring-roseblush", 
              className, 
              !currentWorkerId && "text-muted-foreground"
            )}
            disabled={disabled || isLoading || !scheduledShiftId}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverPrimitive.Portal container={popoverContainerRef?.current}>
          <PopoverContent 
            className="w-[--radix-popover-trigger-width] p-0" 
            align="start"
            style={{ pointerEvents: 'auto' } as React.CSSProperties}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
            onFocusOutside={(e: any) => {
              e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              e.preventDefault();
            }}
          >
            <Command shouldFilter={false}> 
              <CommandList>
                <CommandEmpty>
                  No eligible {targetAssignmentType}s.
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="unassign-option"
                    value="__unassign__" 
                    className="italic select-none text-muted-foreground cursor-pointer data-[selected=true]:bg-transparent"
                    onSelect={() => {
                      handleSelect(null);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        "opacity-0"
                      )}
                    />
                    -- Select {targetAssignmentType} --
                  </CommandItem>
                  {eligibleWorkers.map((worker) => (
                    <CommandItem
                      key={worker.id}
                      value={worker.id} 
                      className="select-none data-[selected=true]:bg-transparent hover:bg-accent/50"
                      onSelect={() => {
                        handleSelect(worker.id);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentWorkerId === worker.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {formatWorkerName(worker)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPrimitive.Portal>
      </Popover>
    </>
  )
}