import { ActionButton, AppText as Text, Card } from '../design/primitives';

export function WorkRefreshNotice({message,onRetry}:{readonly message?:string|null;readonly onRetry:()=>Promise<void>}) {
  return message ? <Card>
    <Text accessibilityLiveRegion="polite">{message}</Text>
    <ActionButton title="Erneut versuchen" onPress={onRetry}/>
  </Card> : null;
}
