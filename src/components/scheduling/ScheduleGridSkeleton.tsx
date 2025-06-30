import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ScheduleGridSkeleton = () => {
  const days = Array(7).fill(0);
  const columns = Array(8).fill(0);

  return (
    <div className="mb-12">
      <ScrollArea className="border rounded-lg bg-white shadow-md">
        <div className="p-3 border-b border-gray-300 bg-oatbeige">
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        <table className="w-full border-collapse text-xs 2xl:text-sm">
          <thead>
            <tr className="bg-[#F9F6F4]">
              <th className="text-left pl-3 pr-4 py-2 font-semibold border-b border-r whitespace-nowrap align-top w-[100px] 2xl:w-[120px] bg-[#F9F6F4]">
                <Skeleton className="h-5 w-10 rounded-md" />
              </th>
              {columns.map((_, i) => (
                <th
                  key={i}
                  className="pl-2 pr-3 py-2 font-semibold border-b border-r last:border-r-0 text-center whitespace-nowrap align-top min-w-[100px] max-w-[180px]"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-28 rounded-md" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {days.map((_, i) => (
              <tr key={i} className="border-t odd:bg-almondmilk/30 even:bg-white">
                <td className="pl-3 pr-4 py-2.5 border-r font-medium whitespace-nowrap align-top w-[100px] 2xl:w-[120px] bg-card">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-4 w-10 rounded-md" />
                  </div>
                </td>
                {columns.map((_, j) => (
                  <td key={j} className="px-2 py-2.5 border-r last:border-r-0 text-center h-[52px] align-middle">
                    <Skeleton className="h-8 w-24 rounded-md mx-auto" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default ScheduleGridSkeleton; 