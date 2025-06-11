import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ScheduleGridSkeleton = () => {
  const weekDays = Array.from({ length: 7 });
  const roles = [
    { name: "Role 1", columns: [1, 2, 3] },
    { name: "Role 2", columns: [1, 2] },
  ];

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="grid grid-cols-8 gap-2">
        {/* Header: Empty corner + Days of the week */}
        <div />
        {weekDays.map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>

      {roles.map((role, roleIndex) => (
        <div key={roleIndex} className="mt-4">
          <Skeleton className="h-6 w-1/4 mb-3 rounded-md" />
          <div className="grid grid-cols-8 gap-2 items-start">
            {/* Role/Column Headers */}
            {role.columns.map((_, colIndex) => (
              <React.Fragment key={colIndex}>
                {colIndex === 0 && <div className="col-span-1" />}
                <div className="col-span-1">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </React.Fragment>
            ))}

            {/* Empty cells to fill the row if needed */}
            {Array.from({ length: 8 - 1 - role.columns.length }).map((_, i) => (
               <div key={`empty-header-${i}`} />
            ))}

            {/* Grid Cells for each day */}
            {weekDays.map((_, dayIndex) => (
              <React.Fragment key={dayIndex}>
                <div className="col-span-1 self-center">
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
                {role.columns.map((_, colIndex) => (
                  <div key={`${dayIndex}-${colIndex}`} className="col-span-1">
                    <Skeleton className="h-16 w-full rounded-md" />
                  </div>
                ))}
                {/* Fill empty space */}
                {Array.from({ length: 8 - 1 - role.columns.length }).map((_, i) => (
                    <div key={`empty-cell-${i}`} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
       <div className="space-y-4 pt-4">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-2 gap-y-3">
                {/* Header Row */}
                <Skeleton className="h-10 col-span-1 rounded-lg" />
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={`header-${i}`} className="h-10 col-span-1 rounded-lg" />
                ))}

                {/* Data Rows */}
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <React.Fragment key={`row-${rowIndex}`}>
                        <Skeleton className="h-16 col-span-1 rounded-lg" />
                        {Array.from({ length: 7 }).map((_, colIndex) => (
                            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-16 col-span-1 rounded-lg" />
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    </div>
  );
};

export default ScheduleGridSkeleton; 