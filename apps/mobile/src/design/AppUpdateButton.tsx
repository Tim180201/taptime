import { useState } from 'react';
import { Linking } from 'react-native';
import { APP_URL } from '../../../../shared/product';
import { ActionButton, AppText } from './primitives';

export function AppUpdateButton() {
  const [failed, setFailed] = useState(false);
  return <>
    <ActionButton title="App aktualisieren" onPress={() => {
      setFailed(false);
      void Linking.openURL(APP_URL).catch(() => setFailed(true));
    }} />
    {failed ? <AppText accessibilityRole="alert">Der Link konnte nicht geöffnet werden. Versuche es erneut.</AppText> : null}
  </>;
}
