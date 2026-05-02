package tk.glucodata;

import android.util.Log;

/**
 * Minimal compatibility shim for libg.so bootstrap inside Glucore.
 *
 * The packaged vendor library was built with the Juggluco WEAROS_MESSAGES path
 * enabled and resolves tk.glucodata.MessageSender during JNI_OnLoad. Glucore's
 * Sibionics EU index 0 path does not use Juggluco's watch/mirror transport, so
 * these methods intentionally act as no-ops.
 */
public final class MessageSender {
    private static final String TAG = "JugglucoCompat";

    private MessageSender() {}

    public static boolean sendData(byte[] data) {
        Log.i(TAG, "Ignoring vendor sendData callback");
        return false;
    }

    public static void sendMessageOn(boolean enabled) {
        Log.i(TAG, "Ignoring vendor sendMessageOn callback");
    }

    public static boolean sendDatawithName(String name, byte[] data) {
        Log.i(TAG, "Ignoring vendor sendDatawithName callback");
        return false;
    }

    public static void sendNameMessageOn(String name, boolean enabled) {
        Log.i(TAG, "Ignoring vendor sendNameMessageOn callback");
    }
}
