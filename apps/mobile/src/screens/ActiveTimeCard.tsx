import {captureStatus,captureDuration,type SafeOwnTimeRecord} from '@taptime/mobile-work-contract';
import {ActionButton,AppText as Text,Card} from '../design/primitives';

/** Both entry points use the same capability and its queue/acknowledgement sequence. */
export function ActiveTimeCard({record,disabled,onStop,onBreak}:{record:SafeOwnTimeRecord;disabled:boolean;onStop:()=>void;onBreak:()=>void}) {
  return <Card>
    <Text style={{fontWeight:'800'}}>{captureStatus(record)}</Text>
    {record.calendar ? <Text>{captureDuration(record.calendar.workDurationSeconds)}</Text> : null}
    <ActionButton title="Zeit beenden" tone="cta" disabled={disabled} onPress={onStop}/>
    <ActionButton title={record.breakStartedAt?'Pause beenden':'Pause starten'} tone="secondary" disabled={disabled} onPress={onBreak}/>
  </Card>;
}
