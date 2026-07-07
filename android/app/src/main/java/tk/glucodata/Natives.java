package tk.glucodata;

/**
 * Minimal Glucore-owned wrapper for the proprietary Juggluco native surface.
 *
 * This class exists so the JNI bridge can pass the correct tk.glucodata.Natives
 * jclass into symbols exported by libg.so. Glucore app code should keep using
 * com.berdegeus.glucore.GlucoreSibionicsBridge rather than calling this API directly.
 */
public final class Natives {
    private Natives() {}

    public static native int setfilesdir(String dir, String country, String nativedir);
    public static native void setlocale(String loc);
    public static native String getLibraryName();

    public static native String addSIscangetName(String barcode, int[] indexptr);
    public static native long str2sensorptr(String sensor);
    public static native String sensorptr2str(long sensorptr);
    public static native long[] activeSensorPtrs();
    public static native String[] activeSensors();

    public static native String getSensorName(long dataptr);
    public static native String getDeviceAddress(long dataptr, boolean getnew);
    public static native int getSensorptrSiSubtype(long sensorptr);
    public static native void setSensorptrSiSubtype(long sensorptr, int type);
    public static native String siGetDeviceName(long dataptr);

    // Runtime context
    public static native long getdataptr(String sensorname);

    // BLE device matching and saving
    public static native String getSiBluetoothNum(long dataptr);
    public static native void siSaveDeviceName(long dataptr, String deviceName);
    public static native void setDeviceAddress(long dataptr, String deviceAddress);
    public static native void EverSenseClear(long dataptr);

    // EU BLE protocol
    public static native byte[] siAuthBytes(long dataptr);
    public static native boolean siNotchinese(long dataptr);
    public static native byte[] getSItimecmd();
    public static native byte[] getSIActivation();
    public static native byte[] getSIResetBytes();
    public static native byte[] siAsknewdata(long dataptr);

    // Data processing
    public static native long SIprocessData(long dataptr, byte[] bluetoothdata, long mmsec);
    public static native long[] getlastGlucose();

    // Sensor-type discrimination (Juggluco convention: 0x10 = Sibionics,
    // 0x20 = Accu-Chek SmartGuide, 0x30 = CareSens Air, 0x40 = Dexcom,
    // 3 = Libre 3, anything else = Libre 1/2).
    public static native int getLibreVersion(long dataptr);
    public static native int getSensorptrLibreVersion(long sensorptr);
}
