package ar.amiritmo.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.records.HeartRateRecord;
import androidx.health.connect.client.records.OxygenSaturationRecord;
import androidx.health.connect.client.records.Record;
import androidx.health.connect.client.request.ReadRecordsRequest;
import androidx.health.connect.client.response.ReadRecordsResponse;
import androidx.health.connect.client.time.TimeRangeFilter;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.jvm.JvmClassMappingKt;
import kotlinx.coroutines.BuildersKt;

/**
 * Lee de Health Connect (solo lectura) la saturación de oxígeno y el pulso que guardan los relojes y pulseras
 * (Samsung Health, Google Fit, Xiaomi, etc.). No escribe nada ni lee otros datos.
 */
@CapacitorPlugin(name = "HealthSync")
public class HealthSyncPlugin extends Plugin {

    private static final String PROVEEDOR = "com.google.android.apps.healthdata";
    private static final String P_SPO2 = "android.permission.health.READ_OXYGEN_SATURATION";
    private static final String P_PULSO = "android.permission.health.READ_HEART_RATE";
    private static final long VENTANA_PULSO_MS = 5 * 60 * 1000L; // el pulso "de la toma" es el más cercano dentro de 5 minutos

    private HealthConnectClient cliente() {
        return HealthConnectClient.Companion.getOrCreate(getContext(), PROVEEDOR);
    }

    private Set<String> concedidos() throws Exception {
        final HealthConnectClient c = cliente();
        return BuildersKt.<Set<String>>runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> c.getPermissionController().getGrantedPermissions(cont));
    }

    private void responderPermisos(final PluginCall call) {
        new Thread(() -> {
            JSObject r = new JSObject();
            try {
                Set<String> g = concedidos();
                boolean spo2 = g.contains(P_SPO2), pulso = g.contains(P_PULSO);
                r.put("spo2", spo2);
                r.put("pulso", pulso);
                r.put("granted", spo2 && pulso);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("No se pudo consultar Health Connect: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int st = HealthConnectClient.Companion.getSdkStatus(getContext(), PROVEEDOR);
        JSObject r = new JSObject();
        // 3 = disponible, 2 = hay que actualizar Health Connect, 1 = no está instalado
        r.put("status", st == 3 ? "available" : st == 2 ? "update" : "missing");
        call.resolve(r);
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        responderPermisos(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Set<String> permisos = new HashSet<>(Arrays.asList(P_SPO2, P_PULSO));
            Intent intent = PermissionController.Companion.createRequestPermissionResultContract(PROVEEDOR).createIntent(getContext(), permisos);
            startActivityForResult(call, intent, "permisosResultado");
        } catch (Exception e) {
            call.reject("No se pudo abrir Health Connect: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void permisosResultado(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        responderPermisos(call);
    }

    private <T extends Record> List<T> leerTodos(Class<T> clase, Instant desde, Instant hasta) throws Exception {
        final HealthConnectClient c = cliente();
        List<T> todos = new ArrayList<>();
        String token = null;
        int vueltas = 0;
        do {
            final ReadRecordsRequest<T> req = new ReadRecordsRequest<>(
                JvmClassMappingKt.getKotlinClass(clase),
                TimeRangeFilter.Companion.between(desde, hasta),
                Collections.emptySet(),
                true,
                1000,
                token
            );
            ReadRecordsResponse<T> resp = BuildersKt.<ReadRecordsResponse<T>>runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> c.readRecords(req, cont));
            todos.addAll(resp.getRecords());
            token = resp.getPageToken();
            vueltas++;
        } while (token != null && !token.isEmpty() && vueltas < 30);
        return todos;
    }

    // Devuelve el pulso (lpm) de la muestra más cercana a t dentro de la ventana, o -1.
    private static long pulsoCercano(long[] tiempos, long[] valores, long t) {
        if (tiempos.length == 0) return -1;
        int lo = 0, hi = tiempos.length - 1;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (tiempos[mid] < t) lo = mid + 1;
            else hi = mid;
        }
        int mejor = -1;
        long dist = Long.MAX_VALUE;
        for (int i = Math.max(0, lo - 1); i <= Math.min(tiempos.length - 1, lo); i++) {
            long d = Math.abs(tiempos[i] - t);
            if (d < dist) {
                dist = d;
                mejor = i;
            }
        }
        return mejor >= 0 && dist <= VENTANA_PULSO_MS ? valores[mejor] : -1;
    }

    @PluginMethod
    public void leer(final PluginCall call) {
        final long desde = call.getData().optLong("desde", 0), hasta = call.getData().optLong("hasta", System.currentTimeMillis());
        new Thread(() -> {
            try {
                Instant d = Instant.ofEpochMilli(desde), h = Instant.ofEpochMilli(hasta);
                List<OxygenSaturationRecord> sat = leerTodos(OxygenSaturationRecord.class, d, h);
                List<HeartRateRecord> pul = leerTodos(HeartRateRecord.class, d, h);

                // Todas las muestras de pulso, ordenadas por hora, para ubicar el pulso de cada toma de saturación.
                List<long[]> muestras = new ArrayList<>();
                JSArray pulsosSueltos = new JSArray();
                for (HeartRateRecord rec : pul) {
                    List<HeartRateRecord.Sample> ms = rec.getSamples();
                    for (HeartRateRecord.Sample m : ms) muestras.add(new long[] { m.getTime().toEpochMilli(), m.getBeatsPerMinute() });
                    if (ms.size() > 0 && ms.size() <= 3) { // medición puntual (no el registro continuo del día): se importa como pulso
                        double suma = 0;
                        for (HeartRateRecord.Sample m : ms) suma += m.getBeatsPerMinute();
                        JSObject o = new JSObject();
                        o.put("id", rec.getMetadata().getId());
                        o.put("t", rec.getStartTime().toEpochMilli());
                        o.put("v", Math.round(suma / ms.size()));
                        o.put("origen", rec.getMetadata().getDataOrigin().getPackageName());
                        pulsosSueltos.put(o);
                    }
                }
                Collections.sort(muestras, (a, b) -> Long.compare(a[0], b[0]));
                long[] ts = new long[muestras.size()], vs = new long[muestras.size()];
                for (int i = 0; i < ts.length; i++) {
                    ts[i] = muestras.get(i)[0];
                    vs[i] = muestras.get(i)[1];
                }

                JSArray saturaciones = new JSArray();
                for (OxygenSaturationRecord rec : sat) {
                    JSObject o = new JSObject();
                    long t = rec.getTime().toEpochMilli();
                    o.put("id", rec.getMetadata().getId());
                    o.put("t", t);
                    o.put("v", rec.getPercentage().getValue());
                    o.put("origen", rec.getMetadata().getDataOrigin().getPackageName());
                    long p = pulsoCercano(ts, vs, t);
                    if (p > 0) o.put("pul", p);
                    saturaciones.put(o);
                }
                JSObject r = new JSObject();
                r.put("spo2", saturaciones);
                r.put("pulso", pulsosSueltos);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("No se pudieron leer los datos: " + e.getMessage());
            }
        }).start();
    }
}
