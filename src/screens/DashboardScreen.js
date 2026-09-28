import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmgWaveform } from '../components/trainer/emg-waveform';
import {
  AppColors,
  AppGradients,
  CardShadow,
  Radius,
  Spacing,
  colorForName,
  initialsForName,
} from '../constants/appTheme';
import { useSimulatedEMG } from '../data/simulatedSource';
import { updateProfile } from '../data/profiles';

const REP_THRESHOLD_UP = 0.5;
const REP_THRESHOLD_DOWN = 0.35;
const WAVEFORM_WINDOW = 32;

function fatigueColor(fatiga) {
  if (fatiga >= 70) return AppColors.danger;
  if (fatiga >= 35) return AppColors.warning;
  return AppColors.primary;
}

function formatSessionDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function DashboardScreen({ profile, onLogout }) {
  // 'idle': todavía no se arrancó (o se acaba de finalizar una sesión).
  // 'running' / 'paused': sesión en curso.
  const [status, setStatus] = useState('idle');
  const isActive = status === 'running';
  const sample = useSimulatedEMG(!isActive);
  const [repCount, setRepCount] = useState(0);
  const [repState, setRepState] = useState('relajado');
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState(() => new Array(WAVEFORM_WINDOW).fill(0));
  const [history, setHistory] = useState(profile.history || []);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    setWaveform((prev) => [...prev.slice(1), sample.biceps]);

    if (repState === 'relajado' && sample.biceps > REP_THRESHOLD_UP) {
      setRepState('contraido');
    } else if (repState === 'contraido' && sample.biceps < REP_THRESHOLD_DOWN) {
      setRepState('relajado');
      setRepCount((c) => c + 1);
    }
  }, [sample.biceps, isActive, repState]);

  const fatiga = Math.min(100, repCount * 4);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const signalColor = fatigueColor(fatiga);

  async function confirmFinish() {
    const session = {
      date: new Date().toISOString(),
      reps: repCount,
      durationSec: seconds,
      fatiga,
    };
    const updated = { ...profile, history: [...history, session] };
    await updateProfile(updated);
    setHistory(updated.history);

    setStatus('idle');
    setRepCount(0);
    setSeconds(0);
    setRepState('relajado');
    setWaveform(new Array(WAVEFORM_WINDOW).fill(0));
    setConfirmVisible(false);
  }

  function handleStart() {
    setStatus('running');
  }

  function handleFinish() {
    if (repCount === 0 && seconds === 0) return;
    setConfirmVisible(true);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colorForName(profile.name) }]}>
            <Text style={styles.avatarText}>{initialsForName(profile.name)}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{profile.name}</Text>
            <Text style={styles.userSubtitle}>Entrenamiento de bíceps</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logout}>Cambiar perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        {status === 'idle' ? (
          <View style={[styles.statusPill, { backgroundColor: AppColors.bgElevated2 }]}>
            <View style={[styles.statusDot, { backgroundColor: AppColors.textTertiary }]} />
            <Text style={styles.statusText}>Listo para empezar</Text>
          </View>
        ) : (
          <View
            style={[
              styles.statusPill,
              { backgroundColor: repState === 'contraido' ? AppColors.primarySoft : AppColors.bgElevated2 },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: repState === 'contraido' ? AppColors.primary : AppColors.textTertiary },
              ]}
            />
            <Text style={styles.statusText}>
              {repState === 'contraido' ? 'Contraído' : 'Relajado'}
            </Text>
          </View>
        )}
        {status === 'paused' && (
          <View style={[styles.statusPill, { backgroundColor: AppColors.warningSoft }]}>
            <Text style={[styles.statusText, { color: AppColors.warning }]}>Pausado</Text>
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        <Metric icon="🏋️" label="Repeticiones" value={repCount} />
        <Metric icon="⏱️" label="Tiempo" value={`${minutes}:${secs}`} />
        <Metric
          icon="🔥"
          label="Fatiga"
          value={`${fatiga}%`}
          valueColor={fatigueColor(fatiga)}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Señal EMG · Bíceps</Text>
          <Text style={[styles.cardValue, { color: signalColor }]}>
            {Math.round(sample.biceps * 100)}%
          </Text>
        </View>
        <EmgWaveform data={waveform} color={signalColor} />
      </View>

      {status === 'idle' ? (
        <TouchableOpacity style={styles.startButtonWrap} activeOpacity={0.85} onPress={handleStart}>
          <LinearGradient
            colors={AppGradients.primaryButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            <Text style={styles.startButtonText}>▶  Comenzar entrenamiento</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, status === 'paused' ? styles.resumeButton : styles.pauseButton]}
            onPress={() => setStatus((s) => (s === 'paused' ? 'running' : 'paused'))}
          >
            <Text style={styles.actionButtonText}>
              {status === 'paused' ? '▶  Reanudar' : '⏸  Pausar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.finishButton]} onPress={handleFinish}>
            <Text style={[styles.actionButtonText, styles.finishButtonText]}>Finalizar sesión</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionLabel}>TU EVOLUCIÓN</Text>
        {history.length === 0 ? (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyText}>
              Todavía no completaste ningún entrenamiento. ¡Finalizá una sesión para empezar a ver tu progreso!
            </Text>
          </View>
        ) : (
          [...history].reverse().slice(0, 5).map((session, index) => (
            <View key={index} style={styles.historyRow}>
              <View style={styles.historyDateBox}>
                <Text style={styles.historyDateText}>{formatSessionDate(session.date)}</Text>
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyReps}>{session.reps} repeticiones</Text>
                <Text style={styles.historyMeta}>
                  {String(Math.floor(session.durationSec / 60)).padStart(2, '0')}:
                  {String(session.durationSec % 60).padStart(2, '0')} min · Fatiga {session.fatiga}%
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finalizar sesión</Text>
            <Text style={styles.modalMessage}>
              Se va a guardar este entrenamiento en tu historial.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmFinish}>
                <Text style={styles.modalConfirmText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Metric({ icon, label, value, valueColor }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppColors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#08130F', fontWeight: '700', fontSize: 14 },
  userName: { fontSize: 15, fontWeight: '700', color: AppColors.textPrimary },
  userSubtitle: { fontSize: 12, color: AppColors.textSecondary, marginTop: 1 },
  logoutButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  logout: { fontSize: 13, color: AppColors.primary, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700', color: AppColors.textPrimary },
  metricsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  metricBox: {
    flex: 1,
    backgroundColor: AppColors.bgElevated,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    ...CardShadow,
  },
  metricIcon: { fontSize: 18, marginBottom: 4 },
  metricLabel: { fontSize: 11, color: AppColors.textSecondary, marginTop: 2 },
  metricValue: { fontSize: 20, fontWeight: '700', color: AppColors.textPrimary },
  card: {
    backgroundColor: AppColors.bgElevated,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardLabel: { fontSize: 13, color: AppColors.textSecondary, fontWeight: '600' },
  cardValue: { fontSize: 16, fontWeight: '700' },
  startButtonWrap: { marginBottom: Spacing.xxl },
  startButton: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  startButtonText: { color: '#08130F', fontWeight: '700', fontSize: 15 },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xxl },
  actionButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  pauseButton: { backgroundColor: AppColors.warning },
  resumeButton: { backgroundColor: AppColors.primary },
  finishButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AppColors.danger,
  },
  actionButtonText: { color: '#08130F', fontWeight: '700' },
  finishButtonText: { color: AppColors.danger },
  historySection: {},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: AppColors.textTertiary,
    marginBottom: Spacing.md,
  },
  historyEmpty: {
    backgroundColor: AppColors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.lg,
  },
  historyEmptyText: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 19 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyDateBox: {
    backgroundColor: AppColors.bgElevated2,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.md,
  },
  historyDateText: { color: AppColors.textPrimary, fontWeight: '700', fontSize: 12 },
  historyDetails: { flex: 1 },
  historyReps: { color: AppColors.textPrimary, fontWeight: '600', fontSize: 14 },
  historyMeta: { color: AppColors.textSecondary, fontSize: 12, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: AppColors.bgElevated,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: AppColors.textPrimary },
  modalMessage: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  modalCancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
    backgroundColor: AppColors.bgElevated2,
  },
  modalCancelText: { color: AppColors.textSecondary, fontWeight: '600' },
  modalConfirmButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
    backgroundColor: AppColors.danger,
  },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
