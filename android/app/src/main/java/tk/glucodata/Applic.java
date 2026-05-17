package tk.glucodata;

import android.bluetooth.BluetoothAdapter;
import android.util.Log;

/**
 * Minimal compatibility shim for libg.so bootstrap inside Glucore.
 *
 * libg.so caches these static methods during JNI_OnLoad. Glucore intentionally
 * does not pull in Juggluco's full Application/UI runtime, so these methods are
 * kept as conservative no-op compatibility hooks.
 */
public final class Applic {
    private static final String TAG = "JugglucoCompat";

    private Applic() {}

    public static void doglucose(
        String serialNumber,
        int mgdl,
        float glucose,
        float rate,
        int alarm,
        long timestampMs,
        boolean wasBlueOff,
        long sensorStartMs,
        long sensorPtr,
        int sensorGeneration
    ) {
        Log.i(TAG, "Ignoring vendor doglucose callback");
    }

    public static boolean updateDevices() {
        Log.i(TAG, "Ignoring vendor updateDevices callback");
        return false;
    }

    public static boolean bluetoothEnabled() {
        try {
            final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            return adapter != null && adapter.isEnabled();
        } catch (SecurityException exception) {
            Log.w(TAG, "Bluetooth state unavailable to compatibility shim", exception);
            return false;
        }
    }

    public static void speak(String message) {
        Log.i(TAG, "Ignoring vendor speak callback");
    }

    public static void resetWearOS() {
        Log.i(TAG, "Ignoring vendor resetWearOS callback");
    }

    public static void toGarmin(int base) {
        Log.i(TAG, "Ignoring vendor toGarmin callback");
    }

    public static void Garmindeletelast(int base, int position, int end) {
        Log.i(TAG, "Ignoring vendor Garmindeletelast callback");
    }

    public static boolean switchbluetooth(String name, byte[] netInfo, boolean watchBluetooth) {
        Log.i(TAG, "Ignoring vendor switchbluetooth callback");
        return false;
    }

    public static int bluePermission() {
        // Compatibility-only return value matching Juggluco's "permission OK"
        // code path. BLE permission enforcement remains owned by Glucore's
        // real Android layer, not by this shim.
        return 2;
    }
}
