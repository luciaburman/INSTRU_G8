import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AppColors,
  AppGradients,
  CardShadow,
  Radius,
  Spacing,
  colorForName,
  initialsForName,
} from '../constants/appTheme';
import { createProfile, loadProfiles } from '../data/profiles';

export default function LoginScreen({ onProfileSelected }) {
  const [profiles, setProfiles] = useState([]);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    refresh();
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  async function refresh() {
    setProfiles(await loadProfiles());
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = profiles.some((p) => p.name === trimmed);
    if (exists) {
      setError('Ya hay un perfil con ese nombre.');
      return;
    }

    const profile = await createProfile(trimmed);
    setNewName('');
    setError('');
    setShowInput(false);
    await refresh();
    onProfileSelected(profile);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={AppGradients.hero} style={styles.hero}>
        <Animated.View style={{ opacity: fadeIn }}>
          <View style={styles.logoBadge}>
            <View style={styles.logoBars}>
              <View style={[styles.logoBar, { height: 10 }]} />
              <View style={[styles.logoBar, { height: 22 }]} />
              <View style={[styles.logoBar, { height: 14 }]} />
              <View style={[styles.logoBar, { height: 26 }]} />
              <View style={[styles.logoBar, { height: 8 }]} />
            </View>
          </View>
          <Text style={styles.title}>EMG Trainer</Text>
          <Text style={styles.subtitle}>Monitoreá tu bíceps y seguí tu evolución</Text>
        </Animated.View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>TUS PERFILES</Text>

        <FlatList
          data={profiles}
          keyExtractor={(item) => item.name}
          style={styles.list}
          contentContainerStyle={profiles.length === 0 && styles.listEmptyContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.profileCard}
              activeOpacity={0.75}
              onPress={() => onProfileSelected(item)}
            >
              <View style={[styles.avatar, { backgroundColor: colorForName(item.name) }]}>
                <Text style={styles.avatarText}>{initialsForName(item.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{item.name}</Text>
                <Text style={styles.profileMeta}>
                  {item.history?.length
                    ? `${item.history.length} entrenamiento${item.history.length === 1 ? '' : 's'}`
                    : 'Sin entrenamientos todavía'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Todavía no hay perfiles</Text>
              <Text style={styles.emptyText}>Creá el primero para empezar a entrenar.</Text>
            </View>
          }
        />

        {showInput ? (
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Nombre del usuario"
              placeholderTextColor={AppColors.textTertiary}
              value={newName}
              onChangeText={(text) => {
                setNewName(text);
                if (error) setError('');
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            {error ? <Text style={styles.inputError}>{error}</Text> : null}
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowInput(false);
                  setNewName('');
                  setError('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButtonWrap}
                onPress={handleCreate}
                disabled={!newName.trim()}
              >
                <LinearGradient
                  colors={AppGradients.primaryButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.primaryButton, !newName.trim() && styles.primaryButtonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>Guardar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.newProfileButton}
            activeOpacity={0.8}
            onPress={() => setShowInput(true)}
          >
            <Text style={styles.newProfileButtonText}>+  Crear nuevo perfil</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppColors.bg },
  hero: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
  },
  logoBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: AppColors.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: AppColors.textTertiary,
    marginBottom: Spacing.md,
  },
  list: { flexGrow: 0, maxHeight: 320 },
  listEmptyContainer: { flexGrow: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...CardShadow,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: { color: '#08130F', fontWeight: '700', fontSize: 15 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600', color: AppColors.textPrimary },
  profileMeta: { fontSize: 12, color: AppColors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: AppColors.textTertiary },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: AppColors.textPrimary },
  emptyText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  inputCard: {
    backgroundColor: AppColors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  input: {
    backgroundColor: AppColors.bgElevated2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    color: AppColors.textPrimary,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  inputError: {
    color: AppColors.danger,
    fontSize: 12,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  inputActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
    backgroundColor: AppColors.bgElevated2,
  },
  cancelButtonText: { color: AppColors.textSecondary, fontWeight: '600' },
  primaryButtonWrap: { flex: 1 },
  primaryButton: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#08130F', fontWeight: '700' },
  newProfileButton: {
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  newProfileButtonText: { color: AppColors.primary, fontWeight: '700', fontSize: 15 },
});
