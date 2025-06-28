import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ScheduleGridSkeleton = () => {
  // 7 days, 7 columns (matching screenshot)
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const columns = [
    "Prep",
    "Barista",
    "Barista - Opening",
    "Barista",
    "Barista - Closing",
    "Barista",
    "Barista",
  ];

  return (
    <div className="rounded-xl bg-[#F9F6F4] p-4 md:p-6 shadow-sm border max-w-6xl mx-auto">
      {/* Table header: Barista role */}
      <div className="w-full">
        <div className="flex items-center border-b border-[#e7e0db] bg-[#f3ebe7] rounded-t-xl">
          <Skeleton className="h-7 w-24 ml-4 my-3 rounded-md" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#F9F6F4]">
                <th className="sticky left-0 z-10 bg-[#F9F6F4] p-0">
                  <Skeleton className="h-8 w-20 rounded-md ml-2" />
                </th>
                {columns.map((col, i) => (
                  <th key={i} className="p-0">
                    <div className="flex flex-col items-center py-2">
                      <Skeleton className="h-10 w-24 rounded-md mb-1" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr key={day} className={i % 2 === 0 ? "bg-[#f9f6f4] border-b border-[#e7e0db]" : "bg-white border-b border-[#e7e0db]"}>
                  <td className="sticky left-0 z-10 bg-[#f9f6f4] px-2 py-2 align-middle">
                    <div className="flex flex-col items-start">
                      <Skeleton className="h-4 w-16 mb-1 rounded-md" />
                      <Skeleton className="h-3 w-10 rounded-md" />
                    </div>
                  </td>
                  {columns.map((_, j) => (
                    <td key={j} className="px-2 py-2 text-center align-middle">
                      <Skeleton className="h-8 w-16 rounded-md mx-auto" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScheduleGridSkeleton; 