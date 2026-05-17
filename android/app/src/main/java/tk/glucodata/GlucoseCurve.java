package tk.glucodata;

import android.util.Log;

/**
 * Minimal compatibility shim for libg.so bootstrap inside Glucore.
 *
 * The vendor library resolves this class during JNI_OnLoad even though Glucore
 * does not embed Juggluco's UI layer. Only the methods required by JNI_OnLoad
 * are exposed here.
 */
public final class GlucoseCurve {
    private static final String TAG = "JugglucoCompat";

    public void summaryready() {
        Log.i(TAG, "Ignoring vendor summaryready callback");
    }

    public void showsensorinfo(String text, long sensorptr) {
        Log.i(TAG, "Ignoring vendor showsensorinfo callback");
    }
}
