import { AppColors } from '@/constants/appTheme';
import DashboardScreen from '@/screens/DashboardScreen';
import LoginScreen from '@/screens/LoginScreen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

export default function HomeScreen() {
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {currentProfile ? (
        <DashboardScreen
          profile={currentProfile}
          onLogout={() => setCurrentProfile(null)}
        />
      ) : (
        <LoginScreen onProfileSelected={setCurrentProfile} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.bg },
});