import { Button, StyleSheet, Text, View } from 'react-native';
import type { ProductSessionContext } from '../auth/contracts';

interface ScanScreenProps {
  readonly session: ProductSessionContext;
  readonly signOut: () => Promise<void>;
}

export function ScanScreen({ session, signOut }: ScanScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e</Text>
      <Text style={styles.status}>Authentifiziert – NFC-Aktivierung folgt in Block D</Text>
      <Text>Rolle: {session.role === 'administrator' ? 'Administrator' : 'Mitarbeiter'}</Text>
      <Text style={styles.pending}>
        C2 stellt nur den privaten Servertransport bereit und löst keinen Scan aus.
      </Text>
      <Button title="Abmelden" onPress={signOut} testID="sign-out-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  status: {
    marginTop: 16,
    marginBottom: 8,
    color: '#1b5e20',
    fontWeight: '600',
  },
  pending: {
    marginVertical: 24,
    color: '#444',
  },
});
