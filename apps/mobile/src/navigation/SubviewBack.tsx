import {createContext,useContext,useEffect,useRef} from 'react';
import {BackHandler} from 'react-native';
import {ActionButton} from '../design/primitives';

// Handlers exist only while a subview is mounted; no navigation or account state is persisted.
export type BackAction = () => void;
export type RegisterBack = (action: BackAction, priority: number) => () => void;
export const SubviewBackContext = createContext<RegisterBack | null>(null);
export function useSubviewBack(action: BackAction | null, priority=1) {
  const register=useContext(SubviewBackContext);
  const latest=useRef(action);latest.current=action;
  const enabled=action!==null;
  useEffect(()=>{
    if(!enabled)return;
    const back=()=>latest.current?.();
    if(register)return register(back,priority);
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});
    return()=>subscription.remove();
  },[register,enabled,priority]);
}
export function SubviewBack({label,onBack,disabled=false}:{label:string;onBack:BackAction;disabled?:boolean}) {
  useSubviewBack(()=>{if(!disabled)onBack();});
  return <ActionButton title={`← ${label}`} accessibilityLabel={`Zurück zu ${label}`} tone="secondary" disabled={disabled} onPress={onBack}/>;
}
