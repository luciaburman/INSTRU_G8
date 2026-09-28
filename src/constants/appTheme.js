// Paleta y tokens de diseño para el flujo de entrenamiento (login + dashboard).
// Es un tema oscuro fijo (no sigue el modo claro/oscuro del sistema): en apps
// de wearables/EMG el fondo oscuro hace que la señal y las métricas resalten,
// como en un monitor de laboratorio.

export const AppColors = {
  bg: '#0A0F14',
  bgElevated: '#131A22',
  bgElevated2: '#1B2430',
  border: '#232E3B',

  primary: '#2FE0B0',
  primaryDark: '#159C7C',
  primarySoft: 'rgba(47, 224, 176, 0.14)',

  warning: '#F5A623',
  warningSoft: 'rgba(245, 166, 35, 0.14)',

  danger: '#F0554B',
  dangerSoft: 'rgba(240, 85, 75, 0.12)',

  textPrimary: '#F5F7FA',
  textSecondary: '#8A94A6',
  textTertiary: '#5B6472',
};

export const AppGradients = {
  hero: ['#12332A', '#0A0F14'],
  primaryButton: ['#3CF0C0', '#159C7C'],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const CardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
  elevation: 4,
};

const AVATAR_PALETTE = ['#2FE0B0', '#5B9BF0', '#F5A623', '#F0554B', '#B27CF0', '#5CD1E0'];

export function colorForName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initialsForName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
