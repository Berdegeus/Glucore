package tk.glucodata;

import android.util.Log;

/**
 * Minimal compatibility shim for libg.so bootstrap inside Glucore.
 */
public final class Libreview {
    private static final String TAG = "JugglucoCompat";

    private Libreview() {}

    public static boolean libreconfig(boolean libre3, boolean restart) {
        Log.i(TAG, "Ignoring vendor libreconfig callback");
        return false;
    }

    public static boolean putsensor(boolean libre3, byte[] message) {
        Log.i(TAG, "Ignoring vendor putsensor callback");
        return false;
    }
}
