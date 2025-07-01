import React from "react";
import { Edit3 } from 'lucide-react';
import { prefetchEligibleWorkers } from '@/hooks/useEligibleWorkers';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { addDays, format } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE, formatTime12hr as formatTimeInPT } from "@/lib/time";

interface Worker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name?: string | null;
  job_level?: string | null;
}

interface ScheduledShiftForGridDisplay {
  id: string;
  shift_date: string;
  template_id: string | null;
  start_time: string | null;
  end_time: string | null;
  is_recurring_generated: boolean | null;
  positionName?: string;
  
  worker_id: string | null;
  workerName?: string;
  job_level?: string | null;
  assigned_start?: string | null;
  assigned_end?: string | null;
  is_manual_override?: boolean | null;

  // Training worker details
  trainingWorkerId?: string | null;
  trainingWorkerName?: string; // Trainee's Preferred or First name
  trainingWorkerAssignedStart?: string | null;
  trainingWorkerAssignedEnd?: string | null;
  isTrainingAssignmentManuallyOverridden?: boolean | null;
}

interface ShiftTemplate {
  id: string;
  location_id: string | null;
  position_id: string | null;
  days_of_week: string[] | null;
  start_time: string;
  end_time: string;
  lead_type?: string | null;
  schedule_column_group?: number | null;
}

interface Position {
  id: string;
  name: string;
}

interface ProcessedColumn {
  id: string;
  positionId: string;
  positionName: string;
  startTime: string;
  headerText: string;
  headerTimeText: string;
  leadType?: string | null;
  memberTemplates: ShiftTemplate[];
  isPaired?: boolean;
  isPairStart?: boolean;
}

export type ShiftClickContext = 
  | { type: 'existing'; shiftId: string } 
  | { type: 'new'; templateId: string; dateString: string; startTime: string; endTime: string; locationId: string; positionId: string; leadType?: string | null };

interface ScheduleGridProps {
  weekStart: Date;
  scheduledShifts: ScheduledShiftForGridDisplay[];
  shiftTemplates: ShiftTemplate[];
  workers: Worker[];
  positions: Position[];
  editMode?: boolean;
  onShiftClick?: (context: ShiftClickContext) => void;
  locationId?: string;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getWeekDates(start: Date): Date[] {
  // 'start' is a Date object representing the start of the week.
  // We want to generate an array of 7 Date objects for the week.
  // Using addDays handles DST transitions correctly.
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function formatWorkerDisplay(
  workerName: string | undefined,
  jobLevel: string | undefined | null,
  mainShiftStartTime: string,
  mainShiftEndTime: string,
  assignedStart: string | undefined | null,
  assignedEnd: string | undefined | null
): React.ReactNode {
  if (!workerName) return null;

  let namePartElements: React.ReactNode[] = [];
  let nameOnly = workerName;

  if (jobLevel) {
    const levelDisplay = jobLevel.startsWith('L') ? jobLevel : `L${jobLevel}`; // do not show job level in schedule grid
    nameOnly = `${workerName}`;
  }
  namePartElements.push(<span key="name">{nameOnly}</span>);

  if (assignedStart && assignedEnd &&
      (assignedStart !== mainShiftStartTime || assignedEnd !== mainShiftEndTime)) {
    namePartElements.push(
      <span className="inline-flex items-center">
        <span className="font-normal text-gray-600 text-[11px] align-baseline ml-1 mt-[1.5px]">
          {`(${formatTimeInPT(assignedStart)} - ${formatTimeInPT(assignedEnd)})`}
        </span>
      </span>
    );
  }
  return <>{namePartElements}</>;
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ weekStart, scheduledShifts, shiftTemplates, workers, positions, editMode, onShiftClick, locationId }) => {
  const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const todayFormatted = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd');

  const weekDates = getWeekDates(weekStart);
  const groupedData = React.useMemo(() => {
    const rolesMap = new Map<string, ProcessedColumn[]>();
    const sortedRoleNamesList: string[] = []; // Renamed to avoid conflict with sortedRoleNames in return value

    if (!shiftTemplates || !positions) {
      return { rolesMap, sortedRoleNames: sortedRoleNamesList };
    }

    // Step 1: Group templates by their primary role name (e.g., "Barista")
    const templatesByPrimaryRole = new Map<string, ShiftTemplate[]>();
    shiftTemplates.forEach(template => {
      const position = positions.find(p => p.id === template.position_id);
      if (!position || !template.position_id) return;

      let primaryRoleName = position.name.split(' - ')[0];
      if (position.name === "Prep + Barista") {
        primaryRoleName = "Barista"; // Consolidate Prep + Barista under Barista for initial grouping
      }

      if (!templatesByPrimaryRole.has(primaryRoleName)) {
        templatesByPrimaryRole.set(primaryRoleName, []);
      }
      templatesByPrimaryRole.get(primaryRoleName)!.push(template);
    });

    // Step 2: For each primary role, further group into ProcessedColumns
    templatesByPrimaryRole.forEach((roleTemplates, primaryRoleName) => {
      const processedColumnsMap = new Map<string, ProcessedColumn>();

      roleTemplates.forEach(template => {
        const position = positions.find(p => p.id === template.position_id);
        if (!position || !template.position_id) return;

        let groupKey: string;
        if (template.schedule_column_group !== null && template.schedule_column_group !== undefined) {
          groupKey = `${template.position_id}-${template.start_time}-${template.schedule_column_group}`;
        } else {
          groupKey = `${template.position_id}-${template.start_time}-NULL-${template.id}`;
        }

        if (!processedColumnsMap.has(groupKey)) {
          const groupLeadType = template.lead_type;
          let headerText = `${position.name}${groupLeadType ? ` - ${capitalize(groupLeadType)}` : ''}`;
          
          if (primaryRoleName === "Barista" && position.name === "Prep + Barista") {
             if (template.start_time === "09:30:00" || template.start_time === "09:30") {
               headerText = "Prep";
             } else if (template.start_time === "12:00:00" || template.start_time === "12:00") {
               headerText = "Barista";
             }
          }

          const headerTimeText = `${formatTimeInPT(template.start_time || '')} - ${formatTimeInPT(template.end_time || '')}`;
          processedColumnsMap.set(groupKey, {
            id: groupKey,
            positionId: template.position_id,
            positionName: position.name,
            startTime: template.start_time,
            headerText: headerText,
            headerTimeText: headerTimeText,
            leadType: groupLeadType,
            memberTemplates: [template],
          });
        } else {
          const existingGroup = processedColumnsMap.get(groupKey)!;
          existingGroup.memberTemplates.push(template);
          const allEndTimesInGroup = existingGroup.memberTemplates.map(mt => mt.end_time);
          const uniqueEndTimes = Array.from(new Set(allEndTimesInGroup));
          if (uniqueEndTimes.length > 1) {
            const definedClosingTimes = new Set(["21:00:00", "21:30:00"]);
            const allVaryingTimesAreDefinedClosingTimes = uniqueEndTimes.every(et => definedClosingTimes.has(et));
            if (allVaryingTimesAreDefinedClosingTimes) {
              existingGroup.headerTimeText = `${formatTimeInPT(existingGroup.startTime)} - Close`;
            } else {
              existingGroup.headerTimeText = `${formatTimeInPT(existingGroup.startTime)} - Various`;
            }
          } else {
            existingGroup.headerTimeText = `${formatTimeInPT(existingGroup.startTime)} - ${formatTimeInPT(uniqueEndTimes[0])}`;
          }
        }
      });
      
      const sortedColumns = Array.from(processedColumnsMap.values()).sort((a, b) => {
        const getGroupSortKey = (col: ProcessedColumn) => {
            if (col.positionName === "Prep + Barista" && (col.headerText === "Prep" || col.headerText === "Barista")) {
                return "09:30:00"; // Use the earliest start time of the pair to group them
            }
            return col.startTime;
        };

        const sortKeyA = getGroupSortKey(a);
        const sortKeyB = getGroupSortKey(b);

        if (sortKeyA !== sortKeyB) {
            return sortKeyA.localeCompare(sortKeyB);
        }

        // If sort keys are the same, it's either two parts of the pair, or two unrelated shifts starting at the same time.
        // We want to ensure Prep comes before Barista if they are being compared.
        const isAPrepPairPart = a.positionName === "Prep + Barista" && a.headerText === "Prep";
        const isBPrepPairPart = b.positionName === "Prep + Barista" && b.headerText === "Prep";

        if (isAPrepPairPart && !isBPrepPairPart) return -1; // a is Prep, b is Barista or another shift. Prep comes first.
        if (!isAPrepPairPart && isBPrepPairPart) return 1; // b is Prep, a is Barista or another shift. Prep comes first.

        const aIsLead = !!a.leadType;
        const bIsLead = !!b.leadType;
        if (aIsLead && !bIsLead) return -1;
        if (!aIsLead && bIsLead) return 1;
        if (aIsLead && bIsLead) { 
            const leadTypeOrder: { [key: string]: number } = { 'opening': 1, 'closing': 2 };
            const orderA = a.leadType && leadTypeOrder[a.leadType] ? leadTypeOrder[a.leadType] : Number.MAX_SAFE_INTEGER;
            const orderB = b.leadType && leadTypeOrder[b.leadType] ? leadTypeOrder[b.leadType] : Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            if (a.leadType && b.leadType && a.leadType !== b.leadType) return a.leadType.localeCompare(b.leadType);
        }
        const scgA = a.memberTemplates[0]?.schedule_column_group;
        const scgB = b.memberTemplates[0]?.schedule_column_group;
        const aHasScg = scgA !== null && scgA !== undefined;
        const bHasScg = scgB !== null && scgB !== undefined;
        if (aHasScg && !bHasScg) return -1; 
        if (!aHasScg && bHasScg) return 1; 
        if (aHasScg && bHasScg && typeof scgA === 'number' && typeof scgB === 'number' && scgA !== scgB) return scgA - scgB; 
        return a.positionName.localeCompare(b.positionName);
      });

      if (primaryRoleName === "Barista") {
        for (let i = 0; i < sortedColumns.length - 1; i++) {
          const currentCol = sortedColumns[i];
          const nextCol = sortedColumns[i+1];
          const isPrep = currentCol.headerText === "Prep" && currentCol.positionName === "Prep + Barista";
          const isBarista = nextCol.headerText === "Barista" && nextCol.positionName === "Prep + Barista";
          if (isPrep && isBarista) {
            currentCol.isPaired = true;
            currentCol.isPairStart = true;
            nextCol.isPaired = true;
            nextCol.isPairStart = false;
            i++;
          }
        }
      }

      rolesMap.set(primaryRoleName, sortedColumns);
    });
    
    const roleOrder = ["Barista", "Front desk", "Kitchen"];
    Array.from(rolesMap.keys())
      .sort((a, b) => {
        const indexA = roleOrder.indexOf(a);
        const indexB = roleOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      })
      .forEach(name => sortedRoleNamesList.push(name));
    return { rolesMap, sortedRoleNames: sortedRoleNamesList };
  }, [shiftTemplates, positions]);

  // Helper function to render a table for a given role
  const renderRoleTableSection = (roleName: string, columnsForRole: ProcessedColumn[], isSideBySideItem: boolean) => {
    if (!columnsForRole || columnsForRole.length === 0) return null;

    const layoutClass = isSideBySideItem ? 'flex-1 min-w-[400px]' : 'w-full';

    const tableItself = (
      <table className="w-full border-collapse text-xs 2xl:text-sm">
        <thead className="bg-[#F9F6F4]">
          <tr>
            <th
              colSpan={columnsForRole.length + 1}
              className="p-3 text-base 2xl:text-lg font-manrope font-bold text-primary text-left border-b border-gray-300 bg-oatbeige"
            >
              {capitalize(roleName)}
            </th>
          </tr>
          <tr>
            <th className="text-left pl-3 pr-4 py-2 font-semibold border-b border-r whitespace-nowrap align-top w-[100px] 2xl:w-[120px] bg-[#F9F6F4]">Day</th>
            {(() => {
              const headers: React.ReactNode[] = [];
              for (let i = 0; i < columnsForRole.length; i++) {
                const pCol = columnsForRole[i];
                if (pCol.isPaired && pCol.isPairStart) {
                  const nextCol = columnsForRole[i + 1];
                  headers.push(
                    <th key={pCol.id} colSpan={2} className="p-0 font-semibold border-b border-r text-center align-top">
                      <div className="flex w-full">
                        <div className="w-1/2 text-center p-2 border-r">
                          <div className="truncate font-medium">{pCol.headerText}</div>
                          <div className="text-ashmocha text-[11px] 2xl:text-xs truncate">{formatTimeInPT(pCol.startTime)} - {formatTimeInPT(pCol.memberTemplates[0].end_time)}</div>
                        </div>
                        <div className="w-1/2 text-center p-2">
                          <div className="truncate font-medium">{nextCol.headerText}</div>
                          <div className="text-ashmocha text-[11px] 2xl:text-xs truncate">{formatTimeInPT(nextCol.startTime)} - {formatTimeInPT(nextCol.memberTemplates[0].end_time)}</div>
                        </div>
                      </div>
                    </th>
                  );
                  i++;
                } else if (pCol.isPaired && !pCol.isPairStart) {
                  continue;
                } else {
                  headers.push(
                    <th
                      key={pCol.id}
                      className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider border-b border-r last:border-r-0"
                    >
                      <div className="truncate font-medium" title={pCol.headerText}>{pCol.headerText}</div>
                      <div className="text-[11px] 2xl:text-xs text-ashmocha truncate">{pCol.headerTimeText}</div>
                    </th>
                  );
                }
              }
              return headers;
            })()}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {weekDates.map((date, dayIndex) => {
            const dateString = ptDateFormatter.format(date);
            const shiftsForThisDayAndRole = scheduledShifts.filter(s => {
              const shiftPos = positions.find(p => p.name === s.positionName || p.id === s.template_id);
              if (!shiftPos) return false;
              let primaryRoleOfShift = shiftPos.name.split(' - ')[0];
              if (shiftPos.name === "Prep + Barista") primaryRoleOfShift = "Barista";
              return s.shift_date === dateString && primaryRoleOfShift === roleName;
            });

            if (!editMode && shiftsForThisDayAndRole.length === 0) {
              const templatesForThisDayAndRole = columnsForRole.some(col =>
                col.memberTemplates.some(mt => mt.days_of_week && mt.days_of_week.includes(DAYS_OF_WEEK[dayIndex].toLowerCase()))
              );
              if (!templatesForThisDayAndRole) return null;
            }

            const isToday = dateString === todayFormatted;
            let rowClass = "border-t odd:bg-almondmilk/30 even:bg-white";
            if (isToday) {
              rowClass += " text-deeproseblush border-l-2 !border-l-roseblush";
            }
            rowClass += " hover:bg-lavendercream/30";

            return (
              <tr key={dateString} className={rowClass}>
                <td className="pl-3 pr-4 py-2.5 border-r font-medium whitespace-nowrap align-top w-[100px] 2xl:w-[120px] bg-card">
                  <div className="flex flex-col">
                    <span className={isToday ? "font-bold text-[#956D60]" : undefined}>{DAYS_OF_WEEK[dayIndex]}</span>
                    <span className="text-[11px] 2xl:text-xs text-ashmocha">{date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
                  </div>
                </td>
                {(() => {
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < columnsForRole.length; i++) {
                    const column = columnsForRole[i];

                    if (column.isPaired && !column.isPairStart) {
                      continue;
                    }

                    const colSpan = column.isPaired && column.isPairStart ? 2 : 1;
                    let templatesForCell: ShiftTemplate[] = [];
                    let shiftsInCell: ScheduledShiftForGridDisplay[] = [];
                    let cellClasses = "px-2 py-2.5 border-r last:border-r-0 text-center h-[52px] align-middle relative";

                    if (colSpan === 2) {
                      const nextColumn = columnsForRole[i + 1];
                      const currentTemplates = column.memberTemplates.filter(t => t.days_of_week && t.days_of_week.includes(DAYS_OF_WEEK[dayIndex].toLowerCase()));
                      const nextTemplates = nextColumn.memberTemplates.filter(t => t.days_of_week && t.days_of_week.includes(DAYS_OF_WEEK[dayIndex].toLowerCase()));
                      templatesForCell = [...currentTemplates, ...nextTemplates];
                    } else {
                      templatesForCell = column.memberTemplates.filter(template =>
                        template.days_of_week && template.days_of_week.includes(DAYS_OF_WEEK[dayIndex].toLowerCase())
                      );
                    }

                    shiftsInCell = scheduledShifts.filter(s =>
                      s.shift_date === dateString && templatesForCell.some(t => t.id === s.template_id)
                    );

                    if (editMode && templatesForCell.length > 0) {
                      cellClasses += " cursor-pointer group hover:bg-lavendercream/50 dark:hover:bg-slate-800";
                    } else if (templatesForCell.length === 0) {
                      cellClasses += " bg-oatbeige";
                    }

                    cells.push(
                      <td
                        key={`${column.id}-${dateString}`}
                        colSpan={colSpan}
                        className={cellClasses}
                        onClick={() => {
                          if (editMode && onShiftClick && locationId && column.positionId) {
                            if (colSpan === 2) {
                              const prepTemplate = column.memberTemplates[0];
                              if (!prepTemplate) return;

                              const prepShift = shiftsInCell.find(s => s.template_id === prepTemplate.id);

                              if (prepShift) {
                                onShiftClick({ type: 'existing', shiftId: prepShift.id });
                              } else {
                                if (prepTemplate.position_id) {
                                  onShiftClick({
                                    type: 'new',
                                    templateId: prepTemplate.id,
                                    dateString: dateString,
                                    startTime: prepTemplate.start_time,
                                    endTime: prepTemplate.end_time,
                                    locationId: locationId,
                                    positionId: prepTemplate.position_id,
                                    leadType: prepTemplate.lead_type
                                  });
                                }
                              }
                            } else if (shiftsInCell.length > 0) {
                              onShiftClick({ type: 'existing', shiftId: shiftsInCell[0].id });
                            } else if (templatesForCell.length > 0) {
                              const primaryTemplateForCell = templatesForCell[0];
                              if (primaryTemplateForCell.position_id) {
                                onShiftClick({
                                  type: 'new',
                                  templateId: primaryTemplateForCell.id,
                                  dateString: dateString,
                                  startTime: primaryTemplateForCell.start_time,
                                  endTime: primaryTemplateForCell.end_time,
                                  locationId: locationId,
                                  positionId: primaryTemplateForCell.position_id,
                                  leadType: primaryTemplateForCell.lead_type
                                });
                              }
                            }
                          }
                        }}
                        onMouseEnter={() => {
                          if (!editMode) return;
                          // Prefetch for existing shift
                          if (shiftsInCell.length > 0) {
                            const shift = shiftsInCell[0];
                            prefetchEligibleWorkers({
                              scheduledShiftId: shift.id,
                              targetAssignmentType: column.leadType === 'opening' || column.leadType === 'closing' ? 'lead' : 'regular',
                              // Optionally: excludeWorkerId, newShiftClientContext
                            });
                          } else if (templatesForCell.length > 0) {
                            // Prefetch for new shift context
                            const template = templatesForCell[0];
                            prefetchEligibleWorkers({
                              scheduledShiftId: `new-shift-${template.id}-${dateString}`,
                              newShiftClientContext: {
                                templateId: template.id,
                                shiftDate: dateString,
                                startTime: template.start_time,
                                endTime: template.end_time,
                              },
                              targetAssignmentType: template.lead_type === 'opening' || template.lead_type === 'closing' ? 'lead' : 'regular',
                            });
                          }
                        }}
                      >
                        {shiftsInCell.length > 0 ? (
                          shiftsInCell.slice(0, 1).map(shift => { // Render only one worker for paired shift
                            if (shift.workerName) {
                              // Assigned cell: overlay Edit3 icon in top right on hover/focus (edit mode only)
                              return (
                                <div key={shift.id} className="relative flex flex-col items-center justify-center w-full h-full group mb-1 last:mb-0">
                                  <span className="font-medium text-charcoalcocoa text-center w-full flex justify-center">
                                    {formatWorkerDisplay(shift.workerName, shift.job_level, shift.start_time || '', shift.end_time || '', shift.assigned_start, shift.assigned_end)}
                                    {shift.is_recurring_generated && <span className="font-normal text-xs ml-1 mt-[2px]">•</span>}
                                  </span>
                                  {editMode && (
                                    <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 flex items-center cursor-pointer">
                                      <Edit3 size={12} className="text-ashmocha/40 group-hover:text-primary-foreground group-focus:text-primary-foreground" />
                                    </span>
                                  )}
                                  {shift.trainingWorkerName && (
                                    <div className="flex flex-col items-center w-full mt-0.5">
                                      <div className="w-full border-t border-gray-200 my-0.5" />
                                      <span className="font-medium text-[#4F7A63] text-center">Training: {shift.trainingWorkerName}</span>
                                      {(shift.trainingWorkerAssignedStart && shift.trainingWorkerAssignedEnd &&
                                        (shift.trainingWorkerAssignedStart !== (shift.start_time || '') || shift.trainingWorkerAssignedEnd !== (shift.end_time || ''))
                                      ) && (
                                        <span className="text-ashmocha font-normal text-[10px] 2xl:text-[11px] block text-center">
                                          ({formatTimeInPT(shift.trainingWorkerAssignedStart || '')} - {formatTimeInPT(shift.trainingWorkerAssignedEnd || '')})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // Unassigned cell: show Edit3 icon centered in the cell (edit mode only, on hover/focus)
                            return (
                              <div key={`${shift.id}-edit-icon`} className="relative flex items-center justify-center w-full h-full group">
                                <span className="text-ashmocha/40 text-lg">-</span>
                                {editMode && (
                                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 cursor-pointer">
                                    <Edit3 size={20} className="text-ashmocha/40 group-hover:text-primary-foreground group-focus:text-primary-foreground" />
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : templatesForCell.length > 0 && editMode ? (
                          <div className="flex justify-center items-center h-full">
                            <Edit3 size={16} className="mx-auto text-ashmocha/40 group-hover:text-primary-foreground" />
                          </div>
                        ) : (
                          <span className={`text-ashmocha/40 ${templatesForCell.length > 0 ? 'text-lg' : ''}`}>{templatesForCell.length > 0 ? '-' : null}</span>
                        )}
                      </td>
                    );
                    if (colSpan === 2) i++;
                  }
                  return cells;
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    if (isSideBySideItem) {
      return (
        <div key={roleName} className={`${layoutClass}`}>
          <div className="border rounded-lg bg-white shadow-md overflow-hidden">
            {tableItself}
          </div>
        </div>
      );
    }

    return (
      <div key={roleName} className={`${layoutClass}`}>
        <ScrollArea className="border rounded-lg bg-white shadow-md">
          {tableItself}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  };

  if (groupedData.sortedRoleNames.length === 0 && locationId) {
    return <div className="text-center py-10 w-full"><p className="text-gray-500">No shift templates configured for this location.</p></div>;
  }
  if (groupedData.sortedRoleNames.length === 0 && !locationId) {
    return <div className="text-center py-10 w-full"><p className="text-gray-500">No shift templates found for any location.</p><p className="text-gray-400 text-sm">Please set up shift templates in the admin settings.</p></div>;
  }
  
  const baristaRoleName = "Barista";
  const sideBySideCandidates = ["Front desk", "Kitchen"];
  
  const baristaTableData = groupedData.rolesMap.get(baristaRoleName);
  
  const sideBySideRolesToRender = sideBySideCandidates
    .map(roleName => ({ name: roleName, data: groupedData.rolesMap.get(roleName) }))
    .filter(role => role.data && role.data.length > 0);
    
  const otherFullWidthRolesToRender = groupedData.sortedRoleNames
    .filter(roleName => roleName !== baristaRoleName && !sideBySideCandidates.includes(roleName))
    .map(roleName => ({ name: roleName, data: groupedData.rolesMap.get(roleName) }))
    .filter(role => role.data && role.data.length > 0);

  return (
    <div className="">
      {baristaTableData && (
        <div className="mb-12">
          <div className="text-sm text-ashmocha mb-2 ml-1">• Recurring shifts</div>
          {renderRoleTableSection(baristaRoleName, baristaTableData, false)}
        </div>
      )}

      {sideBySideRolesToRender.length > 0 && (
        <div className="flex flex-col xl:flex-row xl:space-x-12 space-y-8 xl:space-y-0 mb-12">
          {sideBySideRolesToRender.map(role => 
            renderRoleTableSection(role.name, role.data!, true)
          )}
        </div>
      )}

      {otherFullWidthRolesToRender.map(role => 
        <div key={role.name} className="mb-12">
          {renderRoleTableSection(role.name, role.data!, false)}
        </div>
      )}
    </div>
  );
};

export default ScheduleGrid; 