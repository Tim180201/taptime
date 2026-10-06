import {useEffect} from 'react';
import {AccessibilityInfo} from 'react-native';
import {AppText} from './primitives';
import {mobileTokens} from './tokens';
export function OutcomeNotice({message,error=false}:{message:string|null;error?:boolean}) {
  useEffect(()=>{if(message)AccessibilityInfo.announceForAccessibility(message);},[message]);
  return message ? <AppText style={{color:error?mobileTokens.color.error:mobileTokens.color.text}}>{message}</AppText> : null;
}
