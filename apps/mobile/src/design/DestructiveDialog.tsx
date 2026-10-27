import { useState, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { ActionButton, AppText as Text } from './primitives';
import { useMobileTokens } from './useMobileTheme';

/** A native modal blocks the underlying trigger. Actions occupy the opposite
 * half of the screen from the opening tap; cancellation is always first. */
export function DestructiveDialog({title,children,confirmLabel,busy,onConfirm,onCancel,triggerY}: {
  title:string; children:ReactNode; confirmLabel:string; busy:boolean;
  onConfirm:()=>void; onCancel:()=>void; triggerY?:number;
}) {
  const tokens=useMobileTokens();
  const [height,setHeight]=useState(0);
  const above=triggerY!==undefined&&triggerY>height/2;
  const actions=<View style={{gap:12,padding:20}}>
    <ActionButton title="Abbrechen" disabled={busy} onPress={onCancel}/>
    <ActionButton title={confirmLabel} tone="warning" disabled={busy||height<=0} onPress={onConfirm}/>
  </View>;
  return <Modal transparent animationType="none" onRequestClose={()=>{if(!busy)onCancel();}}>
    <View onLayout={event=>setHeight(event.nativeEvent.layout.height)} style={{flex:1,backgroundColor:tokens.color.canvas,paddingVertical:32,paddingHorizontal:20}}>
      <View role="alertdialog" accessibilityLabel={title} accessibilityViewIsModal style={{flex:1,borderRadius:12,backgroundColor:tokens.color.surface}}>
        {above?actions:null}
        <ScrollView contentContainerStyle={{padding:20,gap:16}} style={{flex:1}}>
          <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'800'}}>{title}</Text>
          {children}
        </ScrollView>
        {above?null:actions}
      </View>
    </View>
  </Modal>;
}
