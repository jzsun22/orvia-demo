import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeTableSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-oatbeige/60">
            <tr>
              <th
                scope="col"
                className="py-4 pl-8 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-20 animate-pulse duration-1000" />
              </th>
              <th
                scope="col"
                className="py-4 pr-4 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider hidden lg:table-cell xl:hidden"
              >
                <Skeleton className="h-4 w-40 animate-pulse duration-1000" />
              </th>
              <th
                scope="col"
                className="py-4 px-0 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider hidden xl:table-cell"
              >
                <Skeleton className="h-4 w-24 animate-pulse duration-1000" />
              </th>
              <th
                scope="col"
                className="py-4 px-2 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider hidden xl:table-cell"
              >
                <Skeleton className="h-4 w-32 animate-pulse duration-1000" />
              </th>
              <th
                scope="col"
                className="py-4 pr-6 text-left text-sm font-medium text-charcoalcocoa uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-20 animate-pulse duration-1000" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: 16 }).map((_, i) => (
              <tr key={i}>
                <td className="py-6 pl-8 pr-4">
                  <Skeleton className="h-5 w-24 xl:w-40 animate-pulse duration-1000" />
                </td>
                <td className="py-6 pr-4 hidden lg:table-cell xl:hidden">
                  <Skeleton className="h-5 xl:w-64 animate-pulse duration-1000" />
                </td>
                <td className="py-6 px-2 hidden xl:table-cell">
                  <Skeleton className="h-5 w-48 animate-pulse duration-1000" />
                </td>
                <td className="py-6 px-2 hidden xl:table-cell">
                  <Skeleton className="h-5 w-32 animate-pulse duration-1000" />
                </td>
                <td className="py-6 pr-6">
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-md animate-pulse duration-1000" />
                    <Skeleton className="h-8 w-32 rounded-md animate-pulse duration-1000" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeTableSkeleton; 