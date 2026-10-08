import {captureStatus,captureDuration,type SafeOwnTimeRecord} from '@taptime/mobile-work-contract';
import {StyleSheet,View} from 'react-native';
import {ActionButton,AppText as Text,Card} from '../design/primitives';

/** Both entry points use the same capability and its queue/acknowledgement sequence. */
export function ActiveTimeCard({record,disabled,onStop,onBreak,disabledReason,compact=false}:{record:SafeOwnTimeRecord;disabled:boolean;onStop:()=>void;onBreak:()=>void;disabledReason?:string;compact?:boolean}) {
  return <Card>
    {compact ? <View style={styles.summary}>
      <Text style={styles.status}>{captureStatus(record)}</Text>
      {record.calendar ? <Text style={styles.duration}>{captureDuration(record.calendar.workDurationSeconds)}</Text> : null}
    </View> : <>
      <Text style={{fontWeight:'800'}}>{captureStatus(record)}</Text>
      {record.calendar ? <Text>{captureDuration(record.calendar.workDurationSeconds)}</Text> : null}
    </>}
    {disabled?<Text>{disabledReason??'Die Erfassung wird verarbeitet. Bitte warte kurz.'}</Text>:null}
    {compact ? <View style={styles.actions}>
      <ActionButton style={styles.action} title="Zeit beenden" tone="cta" disabled={disabled} onPress={onStop}/>
      <ActionButton style={styles.action} title={record.breakStartedAt?'Pause beenden':'Pause starten'} tone="secondary" disabled={disabled} onPress={onBreak}/>
    </View> : <>
      <ActionButton title="Zeit beenden" tone="cta" disabled={disabled} onPress={onStop}/>
      <ActionButton title={record.breakStartedAt?'Pause beenden':'Pause starten'} tone="secondary" disabled={disabled} onPress={onBreak}/>
    </>}
  </Card>;
}

const styles=StyleSheet.create({
  summary:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},
  status:{flexGrow:1,flexShrink:1,flexBasis:200,fontWeight:'800'},
  duration:{fontSize:13,lineHeight:20},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
  action:{flexGrow:1,flexBasis:128},
});
