import { StyleSheet, View } from 'react-native';

// Visualización tipo ecualizador de la señal EMG: recibe una ventana de
// muestras recientes (0..1) y dibuja una barra por muestra. Da la sensación
// de "señal en vivo" sin necesitar una librería de gráficos.
export function EmgWaveform({ data, color, height = 96 }) {
  return (
    <View style={[styles.track, { height }]}>
      {data.map((value, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: Math.max(3, value * height),
              backgroundColor: color,
              opacity: 0.35 + value * 0.65,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  bar: {
    flex: 1,
    marginHorizontal: 1.5,
    borderRadius: 3,
  },
});
