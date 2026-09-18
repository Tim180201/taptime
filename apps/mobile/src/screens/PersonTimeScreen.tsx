import { LineIcon } from '../design/LineIcon';
import { View } from 'react-native';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import type { ManagedPerson } from '../employees/contracts';
import { roleName } from '../employees/presentation';
import { ActionButton, AppText as Text, Card, Screen } from '../design/primitives';
import { TimeCalendar } from './TimeCalendar';
import { formatClock } from './ownTimeCalendar';
export function PersonTimeScreen({person,value,onBack,onRefresh,busy=false,failed=false,onMonthChange}: {
  readonly person: ManagedPerson; readonly value: MobileOwnTimeQueryResponse|null;
  readonly onBack: ()=>void; readonly onRefresh: ()=>Promise<void>; readonly busy?: boolean; readonly failed?: boolean; readonly onMonthChange?: (month: string)=>void;
}) {
  return <Screen title={person.displayName}>
    <View style={{gap:16}}><ActionButton title="Zurück zur Liste" tone="quiet" onPress={onBack} />
      <Card><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><LineIcon name="person" /><Text accessibilityRole="header" style={{fontSize:22,lineHeight:28,fontWeight:'800',flex:1}}>{person.displayName}</Text></View>
        <Text>{roleName(person.role)}{person.location ? ` · ${person.location.name}` : ''}</Text>
        <Text>{value?.activeRecord ? `Aktiv seit ${formatClock(Date.parse(value.activeRecord.startedAt))} · ${value.activeRecord.targetDisplayName}`
          : value ? 'Gerade inaktiv' : 'Arbeitszeiten werden geladen …'}</Text></Card>
      {failed ? <Text accessibilityRole="alert">Die Zeiten konnten nicht vollständig geladen werden. Bitte aktualisiere die Ansicht.</Text> : null}
    </View>
    {value ? <TimeCalendar value={value} onRefresh={onRefresh} onMonthChange={onMonthChange} /> : <ActionButton title={busy ? 'Wird geladen …' : 'Erneut versuchen'} disabled={busy} onPress={onRefresh} />}
  </Screen>;
}
