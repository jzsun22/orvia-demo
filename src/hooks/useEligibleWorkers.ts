import useSWR, { mutate } from 'swr';

export interface NewShiftClientContext {
  templateId: string;
  shiftDate: string;    // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
}

export type AssignmentType = 'lead' | 'regular' | 'training';

export interface UseEligibleWorkersParams {
  scheduledShiftId: string | null;
  newShiftClientContext?: NewShiftClientContext | null;
  targetAssignmentType: AssignmentType;
  excludeWorkerId?: string | null;
  enabled?: boolean;
}

export interface EligibleWorkerResponseItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  job_level: string;
}

function buildKey(params: UseEligibleWorkersParams): [string, string, string, string, string] | null {
  if (!params.scheduledShiftId) return null;
  return [
    '/api/get-eligible-workers',
    params.scheduledShiftId || '',
    params.newShiftClientContext ? JSON.stringify(params.newShiftClientContext) : '',
    params.targetAssignmentType || '',
    params.excludeWorkerId || ''
  ];
}

const fetcher = async ([url, scheduledShiftId, newShiftClientContextStr, targetAssignmentType, excludeWorkerId]: [string, string, string, string, string]) => {
  const body: any = {
    scheduledShiftId,
    targetAssignmentType,
    excludeWorkerId: excludeWorkerId || undefined,
  };
  if (newShiftClientContextStr) {
    body.newShiftClientContext = JSON.parse(newShiftClientContextStr);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error fetching workers: ${res.status}`);
  }
  return res.json();
};

export default function useEligibleWorkers(params: UseEligibleWorkersParams) {
  const key = params.enabled === false ? null : buildKey(params);
  const { data, error, isLoading } = useSWR<EligibleWorkerResponseItem[]>(key, fetcher);
  return {
    data: data || [],
    error,
    isLoading,
  };
}

export function prefetchEligibleWorkers(params: UseEligibleWorkersParams) {
  const key = buildKey(params);
  if (!key) return;
  mutate(key, fetcher(key));
} 