import {parseEditedZonedMinute, shiftDay, timeIntervalError, toZonedMinuteInput} from '@taptime/core';
import type {KeyboardEvent} from 'react';

export const overnightHint='Liegt „bis“ vor oder gleich „von“, endet die Zeit am nächsten Tag.';
type Values={date:string;start:string;end:string;originalStart?:string|null;originalEnd?:string|null;stopOnly?:boolean};
/** Each unchanged boundary retains its original instant, including seconds and the DST fold. */
export function resolveTimeFields({date,start,end,originalStart,originalEnd,stopOnly=false}:Values) {
  const initialDate=(stopOnly?originalEnd:originalStart);
  const sameDate=!!initialDate && date===toZonedMinuteInput(initialDate).slice(0,10);
  const startedAt=stopOnly?null:parseEditedZonedMinute(`${date}T${start}`,originalStart);
  const unchangedEnd=sameDate && !!originalEnd && end===toZonedMinuteInput(originalEnd).slice(11);
  const endDate=!stopOnly && date && start && end<=start ? shiftDay(date,1) : date;
  const stoppedAt=unchangedEnd?originalEnd!:parseEditedZonedMinute(`${endDate}T${end}`,null);
  return {startedAt,stoppedAt};
}

/** Local to time forms: Enter advances single-line controls; textareas keep newlines. */
export function advanceTimeField(event:KeyboardEvent<HTMLFormElement>) {
  if(event.key!=='Enter' || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if(!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
  const fields=Array.from(event.currentTarget.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled)'));
  const index=fields.indexOf(event.target);
  if(index<0) return;
  event.preventDefault();
  if(fields[index+1]) fields[index+1]!.focus();
  else event.currentTarget.requestSubmit();
}
export function TimeFields(props:Values & {onDate:(v:string)=>void;onStart:(v:string)=>void;onEnd:(v:string)=>void;disabled?:boolean;checkInterval?:boolean}) {
  const {date,start,end,onDate,onStart,onEnd,disabled,stopOnly,checkInterval}=props;
  const {startedAt,stoppedAt}=resolveTimeFields(props);
  const error=checkInterval && startedAt && stoppedAt?timeIntervalError(startedAt,stoppedAt):null;
  return <div className="time-fields full-field">
    <label>Datum<input required type="date" value={date} disabled={disabled} onChange={e=>onDate(e.target.value)}/></label>
    {!stopOnly?<label>Von<input required type="time" step="60" value={start} disabled={disabled} onChange={e=>onStart(e.target.value)} data-field-error={date && start && !startedAt?'Bitte Beginn in deutscher Ortszeit prüfen (Zeitumstellung).':undefined}/></label>:null}
    <label>Bis<input required type="time" step="60" value={end} disabled={disabled} onChange={e=>onEnd(e.target.value)} data-field-error={error??(date && end && (stopOnly||start) && !stoppedAt?'Bitte Ende in deutscher Ortszeit prüfen (Zeitumstellung).':undefined)}/></label>
  </div>;
}
