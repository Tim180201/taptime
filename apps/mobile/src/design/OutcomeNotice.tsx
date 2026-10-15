import {useEffect} from 'react';
import {AccessibilityInfo} from 'react-native';
import {AppText} from './primitives';
import { useMobileTokens } from './useMobileTheme';
export function OutcomeNotice({message,error=false}:{message:string|null;error?:boolean}) {
  const mobileTokens = useMobileTokens();

  useEffect(()=>{if(message)AccessibilityInfo.announceForAccessibility(message);},[message]);
  return message ? <AppText style={{color:error?mobileTokens.color.error:mobileTokens.color.text}}>{message}</AppText> : null;
}
