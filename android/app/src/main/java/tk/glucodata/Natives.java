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

    // Accu-Chek SmartGuide (SIG CGM profile; parsing lives in libg.so)
    public static native byte[] accuAskValues(long dataptr);
    public static native long accuProcessData(long dataptr, byte[] value, long mmsec);
    public static native void accuSetStartTime(long dataptr, byte[] value);

    // FreeStyle Libre 2 — NFC activation / streaming enable. nfcdata() also
    // persists the sensor in libg's store; result: low 16 bits = glucose,
    // high 16 bits = status code (see ScanNfcV in Juggluco).
    public static native int nfcdata(byte[] uid, byte[] info, byte[] dat);
    public static native void enabledStreaming(byte[] uid, byte[] info, int val, byte[] address);
    public static native boolean hasBluetooth(byte[] sensorident, byte[] patchinfo);
    public static native byte activationcommand(byte[] info);
    public static native byte[] activationpayload(byte[] id, byte[] info, byte person);
    public static native byte[] bluetoothOnKey(byte[] sensorident, byte[] patchinfo);
    public static native void bluetoothback(byte[] sensorident, byte[] info);
    public static native String getserial(byte[] uid, byte[] info);
    public static native int getinfogen(byte[] info);
    public static native boolean streamingAllowed();

    // FreeStyle Libre 2 — BLE streaming session
    public static native byte[] sensorUnlockKey(long dataptr);
    public static native void resetbluetooth(long dataptr);
    public static native long processTooth(long dataptr, byte[] bluetoothdata);
    public static native byte[] getstreamingAuthenticationData(long dataptr);
    public static native byte[] getsensorident(long dataptr);
    public static native int getsensorgen(long dataptr);

    // Abbott proprietary algorithm library (extracted from LibreLink by the
    // user; dlopen'd by libg.so itself). V1/V2 call into it.
    public static native void sethaslibrary(boolean val);
    public static native boolean gethaslibrary();
    public static native boolean abbottinit();
    public static native boolean abbottreinit();
    public static native int V1(int i, int i2, byte[] ar1, byte[] ar2);
    public static native byte[] V2(int i, int i2, byte[] ar1, byte[] ar2);
}
