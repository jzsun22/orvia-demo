'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TimeSelectorProps {
  date: Date | undefined
  setDate: (date: Date) => void
}

function TimeSelector({ date, setDate }: TimeSelectorProps) {
  const handleHourChange = (value: string) => {
    const newDate = date ? new Date(date) : new Date()
    const period = newDate.getHours() >= 12 ? 'PM' : 'AM'
    let newHour = parseInt(value, 10)

    if (period === 'PM' && newHour < 12) {
      newHour += 12
    } else if (period === 'AM' && newHour === 12) {
      // Handle 12 AM case
      newHour = 0
    }
    newDate.setHours(newHour)
    setDate(newDate)
  }

  const handleMinuteChange = (value: string) => {
    const newDate = date ? new Date(date) : new Date()
    newDate.setMinutes(parseInt(value))
    setDate(newDate)
  }

  const handlePeriodChange = (value: 'AM' | 'PM') => {
    const newDate = date ? new Date(date) : new Date()
    const hours = newDate.getHours()
    if (value === 'PM' && hours < 12) {
      newDate.setHours(hours + 12)
    } else if (value === 'AM' && hours >= 12) {
      newDate.setHours(hours - 12)
    }
    setDate(newDate)
  }

  const hours = date
    ? date.getHours() === 0 // If it's midnight (00:xx)
      ? 12 // Display 12 AM
      : date.getHours() % 12 || 12 // Otherwise, normal 1-11, or 12 for noon (12:xx)
    : undefined // If no date, no selected hour

  const minutes = date ? date.getMinutes() : 0
  const period = date ? (date.getHours() >= 12 ? 'PM' : 'AM') : 'AM'

  return (
    <div className="flex items-center gap-2">
      <Select
        value={hours !== undefined ? hours.toString() : ''}
        onValueChange={handleHourChange}
      >
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i + 1} value={(i + 1).toString()}>
              {(i + 1).toString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>:</span>
      <Select
        value={minutes.toString().padStart(2, '0')}
        onValueChange={handleMinuteChange}
      >
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 60 / 5 }, (_, i) => (
            <SelectItem key={i * 5} value={(i * 5).toString().padStart(2, '0')}>
              {(i * 5).toString().padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

const timePickerVariants = cva(
  'flex items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'w-full',
      },
      h: {
        sm: 'h-9',
        md: 'h-10',
      },
      w: {
        sm: 'w-40',
        md: 'w-48',
        lg: 'w-56',
        full: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      h: 'md',
      w: 'full',
    },
  },
)

interface TimePickerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timePickerVariants> {
  date?: Date
  setDate: (date?: Date) => void
}

const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  ({ className, variant, h, w, date, setDate, ...props }, ref) => {
    const [isSelecting, setIsSelecting] = React.useState(false)

    return (
      <div
        ref={ref}
        className={cn(timePickerVariants({ variant, h, w, className }))}
        {...props}
      >
        <span>
          {date
            ? date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : 'Select time'}
        </span>
        <Popover
          open={isSelecting}
          onOpenChange={(open) => setIsSelecting(open)}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 border-none text-muted-foreground shadow-none"
              onClick={() => setIsSelecting(!isSelecting)}
            >
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <TimeSelector date={date} setDate={setDate} />
          </PopoverContent>
        </Popover>
      </div>
    )
  },
)

TimePicker.displayName = 'TimePicker'

interface TimePickerInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string // Expects HH:mm or HH:mm:ss format string
  onChange: (value: string) => void
}

const TimePickerInput = React.forwardRef<
  HTMLInputElement,
  TimePickerInputProps
>(({ className, value, onChange, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState('')
  const [date, setDate] = React.useState<Date | undefined>(undefined)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)

  const dateToTimeString = (d: Date) => {
    return d.toTimeString().split(' ')[0].substring(0, 5) // HH:mm
  }

  const stringToDate = (timeString: string | null | undefined) => {
    if (!timeString) return undefined // Handle null or undefined input

    const d = new Date()
    const [hours, minutes] = timeString.split(':').map(Number)

    if (!isNaN(hours) && !isNaN(minutes)) {
      d.setHours(hours, minutes) // Set hours and minutes
      return d
    }
    return undefined
  }

  // Sync from parent value
  React.useEffect(() => {
    // console.log("TimePickerInput useEffect: value changed to", value);
    if (value && typeof value === 'string') {
      const newDate = stringToDate(value)
      // console.log("TimePickerInput useEffect: parsed newDate", newDate);
      setDate(newDate)
      if (newDate) {
        setDisplayValue(
          newDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true, // Ensure 12-hour format is used for display
          }),
        )
      } else {
        setDisplayValue(value) // Fallback to raw value if parsing fails
      }
    } else {
      setDate(undefined)
      setDisplayValue('')
    }
  }, [value])

  // On internal date change (from popover), update parent and display
  const handleDateChange = (newDate?: Date) => {
    // console.log("TimePickerInput handleDateChange: newDate", newDate);
    setDate(newDate)
    if (newDate) {
      onChange(dateToTimeString(newDate))
      setDisplayValue(
        newDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      )
    }
    setIsPopoverOpen(false) // Close popover on change
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative flex items-center', className)}>
          <Input
            ref={ref}
            value={displayValue}
            readOnly
            className="pr-8 focus-visible:ring-offset-0 focus:ring-offset-0 focus-visible:ring-1 focus:ring-1 cursor-pointer" // Make space for the icon
            {...props}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <TimeSelector date={date} setDate={handleDateChange} />
      </PopoverContent>
    </Popover>
  )
})

TimePickerInput.displayName = 'TimePickerInput'

export { TimePicker, TimePickerInput }