# Curl EMG

Web del TP de Instrumentación (Grupo 8): un wearable de EMG para el bíceps que cuenta repeticiones y detecta fatiga muscular.

```
electrodos → INA128 (G = 50, REF = 1,85 V) → etapa final (G = 5) → ADC de la ESP32 (12 bits, 1 kHz)
→ firmware (repeticiones y fatiga) → WiFi → Supabase Realtime → app
```

Publicada en Vercel: https://curl-emg.vercel.app (cada push a `main` se despliega solo).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app: registro e inicio de sesión, perfil, plan, entrenamiento (recibe los datos de la ESP) e historial. |
| `simulador-esp.html` | ESP virtual para probar la app sin hardware: simula la señal a nivel del ADC, la procesa con el algoritmo del firmware y le manda a la app los mismos paquetes que va a mandar la ESP. |
| `analisis.html` | Explicación paso a paso del procesamiento de la señal, con ecuaciones y figuras en vivo. |
| `emg-sim.js` | Simulación de la señal (`SimulatedSubject`) y algoritmo del firmware (`EmgFirmware`), con todos los parámetros al principio. Lo usan el simulador y la página de análisis; la app no. |

No hay build ni dependencias: son archivos estáticos.

## Backend (Supabase)

- Autenticación con email y contraseña.
- Tablas `profiles` y `sessions` (con Row Level Security): perfil del usuario y una fila por serie guardada.
- Los datos en vivo de la ESP no pasan por ninguna tabla: van por un canal de broadcast de Supabase Realtime.

## Comunicación ESP → app

La ESP hace un POST HTTPS a `https://<proyecto>.supabase.co/realtime/v1/api/broadcast` con la anon key en el encabezado `apikey`:

```json
{ "messages": [{ "topic": "curl-emg-G8-01", "event": "paquete",
  "payload": { "v": 1, "seq": 42, "t": 61230, "serie": 1, "reps": 7, "estado": "sin", "fatiga": 18 } }] }
```

| Campo | Significado |
|---|---|
| `v` | versión del formato (1) |
| `seq` | número de paquete, para detectar pérdidas |
| `t` | ms desde que arrancó la ESP |
| `serie` | serie detectada por la ESP (sube después de 8 s sin contracciones) |
| `reps` | repeticiones de esa serie, acumuladas (si se pierde un paquete no se pierde una repetición) |
| `estado` | `calibrando`, `sin`, `moderada` o `alta` |
| `fatiga` | índice 0-100 (la app no lo muestra; se guarda en el historial) |

La ESP manda un paquete con cada repetición o cambio de estado, y uno por segundo aunque no cambie nada. La app escucha el canal `curl-emg-<código del sensor>` (el código se carga en la pestaña Entrenar) y muestra "Sin datos del sensor" si pasan 3 s sin paquetes.

## Probar en local

```bash
python3 -m http.server 8080
```

1. Abrir http://localhost:8080, iniciar sesión e ir a **Entrenar**. La tarjeta Sensor dice "Esperando al sensor".
2. En otra pestaña (o en otra compu) abrir http://localhost:8080/simulador-esp.html con el mismo código de sensor y apretar **Encender ESP**.
3. En la app, **Iniciar entrenamiento**: las repeticiones suben y la fatiga pasa de "Calibrando" a "Frená".
4. En el simulador se pueden probar el descanso entre series, la pérdida de paquetes y el apagado del sensor.

Dejar la pestaña del simulador visible: los navegadores frenan los temporizadores de las pestañas en segundo plano.

## Pendiente

- Pasar `EmgFirmware` (de `emg-sim.js`) a C++ para la ESP32 y agregar el WiFi y el POST.
- Ajustar los umbrales con señal real. La caída de la MDF del 6% sale del dataset; la suba del RMS del 40% es una suposición del modelo.
