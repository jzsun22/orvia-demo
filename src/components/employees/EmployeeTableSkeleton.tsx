import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeTableSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-20" />
              </th>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-24" />
              </th>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-32" />
              </th>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-32" />
              </th>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Skeleton className="h-4 w-20" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="py-3 px-4">
                  <Skeleton className="h-5 w-40" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-5 w-12" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-5 w-48" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-5 w-32" />
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-8 w-32 rounded-md" />
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