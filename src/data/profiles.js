// Guardado simple de perfiles de usuario, en el almacenamiento local del
// celular (AsyncStorage — el "localStorage" de React Native).
//
// Hace falta instalar la librería una vez:
//   npx expo install @react-native-async-storage/async-storage

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'emg_trainer_profiles';

export async function loadProfiles() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveProfiles(profiles) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export async function createProfile(name) {
  const profiles = await loadProfiles();
  const newProfile = {
    name,
    mvcBiceps: null,
    mvcTriceps: null,
    visibleWidgets: ['repeticiones', 'tiempo', 'fatiga', 'barras'],
    history: [],
  };
  profiles.push(newProfile);
  await saveProfiles(profiles);
  return newProfile;
}

export async function updateProfile(updatedProfile) {
  const profiles = await loadProfiles();
  const index = profiles.findIndex((p) => p.name === updatedProfile.name);
  if (index !== -1) {
    profiles[index] = updatedProfile;
    await saveProfiles(profiles);
  }
}
