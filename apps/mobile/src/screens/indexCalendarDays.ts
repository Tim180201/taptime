import { calendarDayAllocations, dayStart, timeRecords } from '@taptime/core';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
// Core owns the allocation of server seconds; the view indexes one immutable frame.

export function indexCalendarDays(ownTime: MobileOwnTimeQueryResponse) {
  const records = timeRecords(ownTime);
  const days = new Map<string, { workSeconds: number; breakSeconds: number }>();
  for (const record of records) for (const part of calendarDayAllocations(record)) {
    const previous = days.get(part.day);
    days.set(part.day, {
      workSeconds: (previous?.workSeconds ?? 0) + part.workSeconds,
      breakSeconds: (previous?.breakSeconds ?? 0) + part.breakSeconds,
    });
  }
  const complete = ownTime.nextCursor === null && records.every(record => record.calendar !== undefined);
  return (firstDay: string, endDay: string) => {
    const from = dayStart(firstDay), to = Math.min(dayStart(endDay), Date.parse(ownTime.windowEndedAt));
    let workSeconds = 0, breakSeconds = 0;
    for (const [day, value] of days) if (day >= firstDay && day < endDay) {
      workSeconds += value.workSeconds;
      breakSeconds += value.breakSeconds;
    }
    return {
      complete: complete && from >= Date.parse(ownTime.windowStartedAt) && from < to,
      milliseconds: workSeconds * 1000, breakMilliseconds: breakSeconds * 1000,
    };
  };
}
