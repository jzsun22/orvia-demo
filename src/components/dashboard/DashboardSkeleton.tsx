import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardSkeleton = () => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 lg:gap-6 2xl:gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white/90 rounded-lg shadow-sm p-6 border border-input flex flex-col"
          >
            <div>
              <Skeleton className="h-10 w-3/4 mb-8 animate-pulse duration-1000" />
              <Skeleton className="h-4 w-1/2 mb-2 animate-pulse duration-1000" />
              <div className="space-y-2 mb-4">
                <Skeleton className="h-4 w-5/6 animate-pulse duration-1000" />
                <Skeleton className="h-4 w-4/6 animate-pulse duration-1000" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <Skeleton className="h-9 w-full rounded-md animate-pulse duration-1000" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <Skeleton className="h-10 w-56 mb-2 animate-pulse duration-1000" />
        <Skeleton className="h-4 w-64 animate-pulse"/>      
      </div>
      <div className="grid grid-cols-2 gap-8 mt-4">
        <div className="bg-white/90 rounded-xl p-6 border border-input">
          <Skeleton className="h-8 w-40 mb-8 animate-pulse duration-1000" />
          <Skeleton className="h-4 w-full mb-4 animate-pulse duration-1000" />
          <Skeleton className="h-4 w-full mb-4 animate-pulse duration-1000" />
        </div>

        <div className="bg-white/90 rounded-xl p-6 border border-input">
          <Skeleton className="h-8 w-40 mb-8 animate-pulse duration-1000" />
          <Skeleton className="h-4 w-full mb-4 animate-pulse duration-1000" />
          <Skeleton className="h-4 w-full mb-4 animate-pulse duration-1000" />
        </div>
      </div>
    </>
  );
};

export default DashboardSkeleton; 