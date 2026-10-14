import { View } from 'react-native';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';
import type { SearchState } from './search';
export function SearchField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  return <View><Text>Suchen</Text><TextField accessibilityLabel="Suchen" value={value} onChangeText={onChange} placeholder="Name eingeben" maxLength={80} editable={!disabled}/></View>;
}
export function SearchStatus({state,onClear,onRetry}:{state:SearchState<unknown,unknown>;onClear?:()=>void;onRetry:()=>void}) {
  return <>
    {state.failed?<View><Text accessibilityRole="alert">Die Daten konnten nicht geladen werden.</Text><ActionButton title="Erneut versuchen" onPress={onRetry}/></View>:null}
    {state.status==='loading'?<Text accessibilityLiveRegion="polite">Wird geladen …</Text>:state.status==='ready'?<>
      <Text accessibilityLiveRegion="polite">{state.nextCursor!==null?'mehr als ':''}{state.items.length} Treffer</Text>
      {state.items.length===0&&state.search?<View><Text>{`Keine Treffer für „${state.search}“`}</Text><ActionButton title="Suche löschen" onPress={onClear}/></View>:null}
    </>:null}
  </>;
}
