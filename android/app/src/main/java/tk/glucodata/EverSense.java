package tk.glucodata;

import android.util.Log;

/**
 * Minimal compatibility shim for libg.so bootstrap inside Glucore.
 */
public final class EverSense {
    private static final String TAG = "JugglucoCompat";

    private EverSense() {}

    public static void broadcastglucose(int mgdl, float rate, long timestampMs) {
        Log.i(TAG, "Ignoring vendor EverSense callback");
    }
}
