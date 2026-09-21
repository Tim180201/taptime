import { AddTimeControl, TimeRecordControls } from '../timeEditing/TimeEditingControls';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BUSINESS_TIME_ZONE } from '@taptime/core';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { ActionButton, AppText as Text, TouchTarget, Card } from '../design/primitives';
import { LineIcon } from '../design/LineIcon';
import { mobileTokens } from '../design/tokens';
import { businessDay, dayStart, formatClock, formatDuration, formatHours, intervalMilliseconds,
  monthDays, provenance, rangeSummary, recordsForDay, shiftDay, shiftMonth, weekStart } from './ownTimeCalendar';

export function TimeCalendar({value: ownTime,onRefresh,onMonthChange,targetMembershipId}: {readonly targetMembershipId?: string; readonly value: MobileOwnTimeQueryResponse; readonly onRefresh: ()=>Promise<void>; readonly onMonthChange?: (month: string)=>void}) {
  const [selected,setSelected]=useState(()=>businessDay(Date.parse(ownTime.windowEndedAt)-1));
  const [month,setMonth]=useState(()=>selected.slice(0,7));
  const today = businessDay(Date.parse(ownTime.windowEndedAt)-1);
  const thisWeek = weekStart(today);
  const monthSummary = rangeSummary(ownTime, `${month}-01`, `${shiftMonth(month, 1)}-01`);
  const weekSummary = rangeSummary(ownTime, thisWeek, shiftDay(thisWeek, 7));
  const daily = rangeSummary(ownTime, selected, shiftDay(selected, 1));
  const records = recordsForDay(ownTime, selected);
  const monthTitle = new Intl.DateTimeFormat('de-DE', { timeZone: BUSINESS_TIME_ZONE, month: 'long', year: 'numeric' })
    .format(new Date(`${month}-15T12:00:00Z`));
  const changeMonth = (offset: number) => { const next = shiftMonth(month, offset); setMonth(next); setSelected(`${next}-01`); onMonthChange?.(next); };
  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.summaries}>
      <Card style={styles.summary}><Text style={styles.muted}>{monthTitle}</Text>
        <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit>{monthSummary.complete ? `${formatHours(monthSummary.milliseconds)} h` : '—'}</Text></Card>
      <Card style={styles.summary}><Text style={styles.muted}>{`Woche vom ${thisWeek.split('-').reverse().join('.')}`}</Text>
        <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit>{weekSummary.complete ? `${formatHours(weekSummary.milliseconds)} h` : '—'}</Text></Card>
    </View>
    <Card>
      <View style={styles.monthHeading}>
        <TouchTarget accessibilityRole="button" accessibilityLabel="Voriger Monat" style={styles.arrow} onPress={() => changeMonth(-1)}>
          <LineIcon name="back" /></TouchTarget>
        <Text style={styles.monthTitle}>{monthTitle}</Text>
        <TouchTarget accessibilityRole="button" accessibilityLabel="Nächster Monat" style={styles.arrow} onPress={() => changeMonth(1)}>
          <LineIcon name="arrow" /></TouchTarget>
      </View>
      <View>
      <View style={styles.grid}>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) =>
        <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
      <View style={styles.grid}>{monthDays(month).map((day, index) => {
        if (day === null) return <View key={`space-${index}`} style={styles.daySpace} />;
        const summary = rangeSummary(ownTime, day, shiftDay(day, 1));
        return <TouchTarget key={day} accessibilityRole="button"
          accessibilityLabel={`${day.split('-').reverse().join('.')}, ${summary.complete ? `${formatHours(summary.milliseconds)} Stunden` : 'nicht vollständig geladen'}`}
          accessibilityState={{ selected: day === selected }} onPress={() => setSelected(day)}
          style={[styles.daySpace, day === selected && styles.selected]}>
          <Text style={[styles.dayNumber, day === selected && styles.selectedText]}>{Number(day.slice(8))}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dayHours, day === selected && styles.selectedText]}>
            {summary.complete ? summary.milliseconds > 0 ? formatHours(summary.milliseconds) : '' : '—'}
          </Text>
        </TouchTarget>;
      })}</View></View>
    </Card>
    <Text style={styles.monthTitle}>{new Intl.DateTimeFormat('de-DE', { timeZone: BUSINESS_TIME_ZONE,
      weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selected}T12:00:00Z`))}</Text>
    <AddTimeControl day={selected} targetMembershipId={targetMembershipId} onSaved={onRefresh} />
    {records.map((record) => <Card key={record.timeRecordId}>
      <Text style={{ fontWeight: '800' }}>{record.targetDisplayName}</Text>
      <Text style={styles.muted}>{formatClock(Math.max(dayStart(selected), Date.parse(record.startedAt)))} – {
        record.stoppedAt === null ? 'läuft' : formatClock(Math.min(dayStart(shiftDay(selected, 1)), Date.parse(record.stoppedAt)))} · {record.details ? ({nfc:'gescannt',manual:'manuell erfasst',backfilled:'nachgetragen',recovered:'wiederhergestellt'} as const)[record.details.origin] : provenance(record)}</Text>
      <Text style={styles.duration}>{formatDuration(intervalMilliseconds(record, dayStart(selected),
        Math.min(dayStart(shiftDay(selected, 1)), Date.parse(ownTime.windowEndedAt))))}</Text>
      <TimeRecordControls record={record} targetMembershipId={targetMembershipId} onSaved={onRefresh} />
    </Card>)}
    {records.length === 0 ? <Card><Text>{daily.complete ? 'Für diesen Tag sind keine Zeiten erfasst.'
      : 'Dieser Tag liegt außerhalb des vollständig geladenen Zeitraums.'}</Text></Card> : null}
    <Text style={styles.muted}>Zeitspannen ohne Pausenabzug · Europe/Berlin</Text>
    <Text style={styles.muted}>{ownTimeLoadStatus(ownTime.records.length, ownTime.nextCursor)}</Text>
    {ownTime.nextCursor !== null ? <Text style={styles.muted}>Weitere Zeiten werden geladen …</Text> : null}
    <Text style={styles.muted}>Geladener Zeitraum: {formatOwnTimeTimestamp(ownTime.windowStartedAt)} – {formatOwnTimeTimestamp(ownTime.windowEndedAt)}</Text>
    <ActionButton title="Aktualisieren" tone="quiet" onPress={() => onRefresh()} />
  </ScrollView>;
}
export function formatOwnTimeTimestamp(value: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: BUSINESS_TIME_ZONE }).format(new Date(value));
}
export function resolveDisplayTimeZone(): string { return BUSINESS_TIME_ZONE; }
export function ownTimeLoadStatus(count: number, nextCursor: string | null): string {
  return nextCursor === null ? `${count} Einträge geladen · vollständig im Abfragezeitraum`
    : `${count} Einträge geladen · weitere verfügbar; Summen noch unvollständig`;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 }, summaries: { flexDirection: 'row', gap: 16 },
  summary: { flex: 1, padding: 12 }, number: { fontSize: 40, lineHeight: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  muted: { fontSize: 13, lineHeight: 20, color: mobileTokens.color.textMuted },
  monthHeading: { flexDirection: 'row', alignItems: 'center' }, monthTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285714%', textAlign: 'center', fontSize: 13, color: mobileTokens.color.textMuted },
  daySpace: { width: '14.285714%', minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayNumber: { fontSize: 13, fontWeight: '600' }, dayHours: { maxWidth: '100%', fontSize: 13, lineHeight: 16, color: mobileTokens.color.textMuted },
  selected: { backgroundColor: mobileTokens.color.accent }, selectedText: { color: mobileTokens.color.onAccent },
  duration: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
