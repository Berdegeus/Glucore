/*
 * Glucore Sibionics Native Bridge
 *
 * This is Glucore-owned Android integration code around proprietary Sibionics
 * native libraries packaged with the app. The JNI surface stays intentionally
 * small so Flutter/app layers never deal with vendor-specific loading details.
 *
 * PROPRIETARY DEPENDENCY NOTICE:
 * This code depends on native libraries extracted from the Juggluco Android application.
 * The integration approach is derived from the Juggluco Sibionics implementation path.
 * See NOTICE_JUGGLUCO_NATIVE.md for detailed provenance information.
 */

#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>

#include <cstdint>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#define LOG_TAG "GlucoreSibionics"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

using SetFilesDirFn = jint (*)(JNIEnv*, jclass, jstring, jstring, jstring);
using SetLocaleFn = void (*)(JNIEnv*, jclass, jstring);
using GetLibraryNameFn = jstring (*)(JNIEnv*, jclass);
using StartThreadsFn = void (*)(JNIEnv*, jclass);
using StartMealsFn = void (*)(JNIEnv*, jclass);
using StartSensorsFn = void (*)(JNIEnv*, jclass);
using AddSiScanGetNameFn = jstring (*)(JNIEnv*, jclass, jstring, jintArray);
using Str2SensorPtrFn = jlong (*)(JNIEnv*, jclass, jstring);
using SensorPtr2StrFn = jstring (*)(JNIEnv*, jclass, jlong);
using ActiveSensorPtrsFn = jlongArray (*)(JNIEnv*, jclass);
using ActiveSensorsFn = jobjectArray (*)(JNIEnv*, jclass);
using GetSensorNameFn = jstring (*)(JNIEnv*, jclass, jlong);
using GetDeviceAddressFn = jstring (*)(JNIEnv*, jclass, jlong, jboolean);
using GetSensorPtrSiSubtypeFn = jint (*)(JNIEnv*, jclass, jlong);
using SetSensorPtrSiSubtypeFn = void (*)(JNIEnv*, jclass, jlong, jint);
using GetSensorPtrLibreVersionFn = jint (*)(JNIEnv*, jclass, jlong);
using SiGetDeviceNameFn = jstring (*)(JNIEnv*, jclass, jlong);
using SaveMatchedDeviceFn = jboolean (*)(JNIEnv*, jclass, jstring, jstring, jstring);
using GetInitialWriteFn = jstring (*)(JNIEnv*, jclass, jstring);
using HandleNotificationFn = jstring (*)(JNIEnv*, jclass, jstring, jbyteArray, jlong);

constexpr const char* kVendorNativesClassName = "tk/glucodata/Natives";

constexpr const char* kSetFilesDirSymbol = "Java_tk_glucodata_Natives_setfilesdir";
constexpr const char* kSetLocaleSymbol = "Java_tk_glucodata_Natives_setlocale";
constexpr const char* kGetLibraryNameSymbol = "Java_tk_glucodata_Natives_getLibraryName";
constexpr const char* kStartThreadsSymbol = "Java_tk_glucodata_Natives_startthreads";
constexpr const char* kStartMealsSymbol = "Java_tk_glucodata_Natives_startmeals";
constexpr const char* kStartSensorsSymbol = "Java_tk_glucodata_Natives_startsensors";
constexpr const char* kAddSiScanGetNameSymbol = "Java_tk_glucodata_Natives_addSIscangetName";
constexpr const char* kStr2SensorPtrSymbol = "Java_tk_glucodata_Natives_str2sensorptr";
constexpr const char* kSensorPtr2StrSymbol = "Java_tk_glucodata_Natives_sensorptr2str";
constexpr const char* kActiveSensorPtrsSymbol = "Java_tk_glucodata_Natives_activeSensorPtrs";
constexpr const char* kActiveSensorsSymbol = "Java_tk_glucodata_Natives_activeSensors";
constexpr const char* kGetSensorNameSymbol = "Java_tk_glucodata_Natives_getSensorName";
constexpr const char* kGetDeviceAddressSymbol = "Java_tk_glucodata_Natives_getDeviceAddress";
constexpr const char* kGetSensorPtrSiSubtypeSymbol =
    "Java_tk_glucodata_Natives_getSensorptrSiSubtype";
constexpr const char* kSetSensorPtrSiSubtypeSymbol =
    "Java_tk_glucodata_Natives_setSensorptrSiSubtype";
constexpr const char* kGetSensorPtrLibreVersionSymbol =
    "Java_tk_glucodata_Natives_getSensorptrLibreVersion";
constexpr const char* kSiGetDeviceNameSymbol = "Java_tk_glucodata_Natives_siGetDeviceName";

struct VendorLibrarySpec {
    const char* name;
    bool required;
    bool should_load;
    const char* skip_reason;
};

// Glucore currently targets the tk.glucodata.Natives surface in libg.so.
// libinit.so is a packaged bundletool zip artifact and libnative.so is an ELF
// executable, so neither should be treated as a regular dlopen target.
constexpr VendorLibrarySpec kRequiredVendorLibraries[] = {
    {"libg.so", true, true, nullptr},
};

constexpr VendorLibrarySpec kOptionalSupportLibraries[] = {
    {"libdata-handle-lib.so", false, true, nullptr},
    {"libnative-struct2json.so", false, true, nullptr},
    {"libnative-algorithm-jni-v115G.so", false, true, nullptr},
    {"libnative-algorithm-jni-v116A.so", false, true, nullptr},
    {"libnative-algorithm-v1_1_5G.so", false, true, nullptr},
    {"libnative-algorithm-v1_1_6A.so", false, true, nullptr},
    {"libnative-encrypy-decrypt-v110.so", false, true, nullptr},
    {"libnative-sensitivity-v110.so", false, true, nullptr},
    {"libCALCULATION.so", false, true, nullptr},
    {"libcalibrat2.so", false, true, nullptr},
    {"libcrl_dp.so", false, true, nullptr},
    {"liblibre3extension.so", false, true, nullptr},
};

constexpr VendorLibrarySpec kSkippedArtifacts[] = {
    {
        "libinit.so",
        false,
        false,
        "packaged artifact is not an ELF shared library",
    },
    {
        "libnative.so",
        false,
        false,
        "packaged artifact is an ELF executable, not a shared library",
    },
};

struct BridgeRuntimeState {
    std::mutex mutex;
    bool libraries_loaded = false;
    bool init_attempted = false;
    bool init_succeeded = false;
    std::string native_library_dir;
    std::string last_error;
    std::vector<void*> handles;
    jclass vendor_natives_class = nullptr;
};

BridgeRuntimeState g_state;

std::string JStringToStdString(JNIEnv* env, jstring value) {
    if (value == nullptr) {
        return "";
    }

    const char* chars = env->GetStringUTFChars(value, nullptr);
    if (chars == nullptr) {
        return "";
    }

    std::string copy(chars);
    env->ReleaseStringUTFChars(value, chars);
    return copy;
}

std::string JsonEscape(const std::string& value) {
    std::ostringstream escaped;
    for (char ch : value) {
        switch (ch) {
            case '\\':
                escaped << "\\\\";
                break;
            case '"':
                escaped << "\\\"";
                break;
            case '\n':
                escaped << "\\n";
                break;
            case '\r':
                escaped << "\\r";
                break;
            case '\t':
                escaped << "\\t";
                break;
            default:
                escaped << ch;
                break;
        }
    }
    return escaped.str();
}

jstring MakeJsonSuccess(JNIEnv* env, const std::string& payload) {
    return env->NewStringUTF(payload.c_str());
}

jstring MakeJsonError(JNIEnv* env, const std::string& message) {
    const std::string payload = "{\"error\":\"" + JsonEscape(message) + "\"}";
    return env->NewStringUTF(payload.c_str());
}

std::string BridgeUnavailableMessageLocked(const std::string& operation) {
    std::ostringstream message;
    message << operation << " is unavailable because the proprietary Sibionics bridge is not ready";

    if (!g_state.init_attempted) {
        message << " (init was not attempted)";
    } else if (!g_state.last_error.empty()) {
        message << ": " << g_state.last_error;
    }

    return message.str();
}

bool LoadVendorLibraryLocked(const VendorLibrarySpec& library, const std::string& native_library_dir) {
    if (!library.should_load) {
        LOGI("Skipping packaged artifact %s: %s", library.name, library.skip_reason);
        return true;
    }

    const std::string full_path = native_library_dir + "/" + library.name;
    LOGI(
        "Resolving proprietary library with nativeLibraryDir=%s and path=%s",
        native_library_dir.c_str(),
        full_path.c_str()
    );
    void* handle = dlopen(full_path.c_str(), RTLD_NOW | RTLD_GLOBAL);
    if (handle == nullptr) {
        const char* error = dlerror();
        const char* detail = error != nullptr ? error : "unknown error";
        if (library.required) {
            g_state.last_error =
                "Failed to load required proprietary library " + full_path + ": " + detail;
            LOGE("%s", g_state.last_error.c_str());
        } else {
            LOGE("Failed to load optional vendor library %s: %s", full_path.c_str(), detail);
        }
        return false;
    }

    LOGI("Loaded vendor library: %s", full_path.c_str());
    g_state.handles.push_back(handle);
    return true;
}

bool EnsureVendorLibrariesLoadedLocked(const std::string& native_library_dir) {
    if (g_state.libraries_loaded) {
        return true;
    }

    if (native_library_dir.empty()) {
        g_state.last_error = "nativeLibraryDir was empty during bridge bootstrap";
        return false;
    }

    LOGI("Using Android-provided nativeLibraryDir: %s", native_library_dir.c_str());

    for (const VendorLibrarySpec& artifact : kSkippedArtifacts) {
        LoadVendorLibraryLocked(artifact, native_library_dir);
    }

    for (const VendorLibrarySpec& library : kRequiredVendorLibraries) {
        if (!LoadVendorLibraryLocked(library, native_library_dir)) {
            return false;
        }
    }

    for (const VendorLibrarySpec& library : kOptionalSupportLibraries) {
        LoadVendorLibraryLocked(library, native_library_dir);
    }

    g_state.libraries_loaded = true;
    return true;
}

template <typename SymbolType>
SymbolType ResolveSymbolLocked(const char* symbol_name) {
    dlerror();
    void* symbol = dlsym(RTLD_DEFAULT, symbol_name);
    if (symbol != nullptr) {
        return reinterpret_cast<SymbolType>(symbol);
    }

    for (void* handle : g_state.handles) {
        dlerror();
        symbol = dlsym(handle, symbol_name);
        if (symbol != nullptr) {
            return reinterpret_cast<SymbolType>(symbol);
        }
    }

    g_state.last_error = std::string("Missing proprietary Sibionics symbol: ") + symbol_name;
    LOGE("%s", g_state.last_error.c_str());
    return nullptr;
}

template <typename SymbolType>
SymbolType RequireInitializedSymbolLocked(const char* symbol_name) {
    if (!g_state.init_succeeded) {
        return nullptr;
    }
    return ResolveSymbolLocked<SymbolType>(symbol_name);
}

bool CaptureJavaExceptionLocked(JNIEnv* env, const std::string& operation) {
    if (!env->ExceptionCheck()) {
        return false;
    }

    jthrowable throwable = env->ExceptionOccurred();
    env->ExceptionClear();

    std::string description = operation + " raised a Java exception";
    if (throwable != nullptr) {
        jclass throwable_class = env->FindClass("java/lang/Throwable");
        if (throwable_class != nullptr) {
            jmethodID to_string = env->GetMethodID(
                throwable_class,
                "toString",
                "()Ljava/lang/String;"
            );
            if (to_string != nullptr) {
                jstring message = static_cast<jstring>(env->CallObjectMethod(throwable, to_string));
                if (!env->ExceptionCheck()) {
                    const std::string java_message = JStringToStdString(env, message);
                    if (!java_message.empty()) {
                        description = operation + " raised " + java_message;
                    }
                } else {
                    env->ExceptionClear();
                }
                if (message != nullptr) {
                    env->DeleteLocalRef(message);
                }
            }
            env->DeleteLocalRef(throwable_class);
        }
        env->DeleteLocalRef(throwable);
    }

    g_state.last_error = description;
    LOGE("%s", g_state.last_error.c_str());
    return true;
}

jclass GetVendorNativesClassLocked(JNIEnv* env) {
    if (g_state.vendor_natives_class != nullptr) {
        return g_state.vendor_natives_class;
    }

    jclass local_class = env->FindClass(kVendorNativesClassName);
    if (CaptureJavaExceptionLocked(env, "FindClass(tk.glucodata.Natives)") || local_class == nullptr) {
        if (g_state.last_error.empty()) {
            g_state.last_error = "Unable to resolve tk.glucodata.Natives wrapper class";
        }
        return nullptr;
    }

    jclass global_class = static_cast<jclass>(env->NewGlobalRef(local_class));
    env->DeleteLocalRef(local_class);
    if (CaptureJavaExceptionLocked(env, "NewGlobalRef(tk.glucodata.Natives)") ||
        global_class == nullptr) {
        if (g_state.last_error.empty()) {
            g_state.last_error = "Unable to retain tk.glucodata.Natives wrapper class";
        }
        return nullptr;
    }

    g_state.vendor_natives_class = global_class;
    return g_state.vendor_natives_class;
}

std::string JStringResultToStdString(JNIEnv* env, jstring value) {
    if (CaptureJavaExceptionLocked(env, "vendor JNI string call")) {
        return "";
    }
    return JStringToStdString(env, value);
}

std::string BuildSessionJson(
    const std::string& sensor_id,
    bool connected,
    const std::string& source,
    const std::string& sensor_name = "",
    const std::string& device_name = "",
    const std::string& device_address = "",
    int subtype = -1,
    jint native_scan_index = -1,
    jlong sensor_ptr = 0,
    int libre_version = -1
) {
    std::ostringstream payload;
    payload << "{"
            << "\"status\":\"ok\","
            << "\"source\":\"" << JsonEscape(source) << "\","
            << "\"sensorId\":\"" << JsonEscape(sensor_id) << "\","
            << "\"connected\":" << (connected ? "true" : "false");

    if (!sensor_name.empty()) {
        payload << ",\"sensorName\":\"" << JsonEscape(sensor_name) << "\"";
    }
    if (!device_name.empty()) {
        payload << ",\"deviceName\":\"" << JsonEscape(device_name) << "\"";
    }
    if (!device_address.empty()) {
        payload << ",\"deviceAddress\":\"" << JsonEscape(device_address) << "\"";
    }
    if (subtype >= 0) {
        payload << ",\"subtype\":" << subtype;
    }
    if (native_scan_index >= 0) {
        payload << ",\"nativeScanIndex\":" << native_scan_index;
    }
    if (sensor_ptr != 0) {
        payload << ",\"nativeSensorPtr\":" << static_cast<std::int64_t>(sensor_ptr);
    }
    if (libre_version >= 0) {
        payload << ",\"libreVersion\":" << libre_version;
    }

    payload << "}";
    return payload.str();
}

bool TryGetPrimarySensorPtrLocked(JNIEnv* env, jclass vendor_class, jlong* sensor_ptr_out) {
    *sensor_ptr_out = 0;

    ActiveSensorPtrsFn active_sensor_ptrs_fn =
        RequireInitializedSymbolLocked<ActiveSensorPtrsFn>(kActiveSensorPtrsSymbol);
    if (active_sensor_ptrs_fn != nullptr) {
        jlongArray ptrs = active_sensor_ptrs_fn(env, vendor_class);
        if (CaptureJavaExceptionLocked(env, "Natives.activeSensorPtrs")) {
            return false;
        }

        if (ptrs != nullptr) {
            const jsize count = env->GetArrayLength(ptrs);
            if (count > 0) {
                jlong first_ptr = 0;
                env->GetLongArrayRegion(ptrs, 0, 1, &first_ptr);
                if (CaptureJavaExceptionLocked(env, "GetLongArrayRegion(activeSensorPtrs)")) {
                    env->DeleteLocalRef(ptrs);
                    return false;
                }
                *sensor_ptr_out = first_ptr;
            }
            env->DeleteLocalRef(ptrs);
        }
    }

    if (*sensor_ptr_out != 0) {
        return true;
    }

    ActiveSensorsFn active_sensors_fn =
        RequireInitializedSymbolLocked<ActiveSensorsFn>(kActiveSensorsSymbol);
    Str2SensorPtrFn str2sensorptr_fn =
        RequireInitializedSymbolLocked<Str2SensorPtrFn>(kStr2SensorPtrSymbol);
    if (active_sensors_fn == nullptr || str2sensorptr_fn == nullptr) {
        return true;
    }

    jobjectArray names = active_sensors_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.activeSensors")) {
        return false;
    }
    if (names == nullptr) {
        return true;
    }

    const jsize count = env->GetArrayLength(names);
    if (count > 0) {
        jstring first_name = static_cast<jstring>(env->GetObjectArrayElement(names, 0));
        if (CaptureJavaExceptionLocked(env, "GetObjectArrayElement(activeSensors)")) {
            env->DeleteLocalRef(names);
            return false;
        }
        if (first_name != nullptr) {
            *sensor_ptr_out = str2sensorptr_fn(env, vendor_class, first_name);
            if (CaptureJavaExceptionLocked(env, "Natives.str2sensorptr(activeSensor)")) {
                env->DeleteLocalRef(first_name);
                env->DeleteLocalRef(names);
                return false;
            }
            env->DeleteLocalRef(first_name);
        }
    }

    env->DeleteLocalRef(names);
    return true;
}

bool TryGetPrimaryActiveSensorIdLocked(JNIEnv* env, jclass vendor_class, std::string* sensor_id_out) {
    sensor_id_out->clear();

    ActiveSensorsFn active_sensors_fn =
        RequireInitializedSymbolLocked<ActiveSensorsFn>(kActiveSensorsSymbol);
    if (active_sensors_fn == nullptr) {
        return false;
    }

    jobjectArray names = active_sensors_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.activeSensors")) {
        return false;
    }
    if (names == nullptr) {
        return true;
    }

    const jsize count = env->GetArrayLength(names);
    if (count > 0) {
        jstring first_name = static_cast<jstring>(env->GetObjectArrayElement(names, 0));
        if (CaptureJavaExceptionLocked(env, "GetObjectArrayElement(activeSensors)")) {
            env->DeleteLocalRef(names);
            return false;
        }
        if (first_name != nullptr) {
            *sensor_id_out = JStringToStdString(env, first_name);
            env->DeleteLocalRef(first_name);
        }
    }

    env->DeleteLocalRef(names);
    return true;
}

}  // namespace

extern "C"
JNIEXPORT jint JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_init(
    JNIEnv* env,
    jclass clazz,
    jstring filesDir,
    jstring nativeLibraryDir,
    jstring countryCode
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    g_state.init_attempted = true;
    g_state.native_library_dir = JStringToStdString(env, nativeLibraryDir);
    g_state.last_error.clear();

    if (!EnsureVendorLibrariesLoadedLocked(g_state.native_library_dir)) {
        g_state.init_succeeded = false;
        return -1;
    }

    jclass vendor_class = GetVendorNativesClassLocked(env);
    if (vendor_class == nullptr) {
        g_state.init_succeeded = false;
        return -2;
    }

    SetFilesDirFn setfilesdir_fn = ResolveSymbolLocked<SetFilesDirFn>(kSetFilesDirSymbol);
    if (setfilesdir_fn == nullptr) {
        g_state.init_succeeded = false;
        return -3;
    }

    GetLibraryNameFn get_library_name_fn =
        ResolveSymbolLocked<GetLibraryNameFn>(kGetLibraryNameSymbol);
    if (get_library_name_fn == nullptr) {
        g_state.init_succeeded = false;
        return -4;
    }

    LOGI("Initializing Glucore Sibionics bridge via tk.glucodata.Natives.setfilesdir");
    const jint result = setfilesdir_fn(env, vendor_class, filesDir, countryCode, nativeLibraryDir);
    if (CaptureJavaExceptionLocked(env, "Natives.setfilesdir")) {
        g_state.init_succeeded = false;
        return -5;
    }

    g_state.init_succeeded = (result == 0);
    if (!g_state.init_succeeded) {
        g_state.last_error = "Natives.setfilesdir returned code " + std::to_string(result);
        return result;
    }

    jstring library_name_value = get_library_name_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.getLibraryName")) {
        g_state.init_succeeded = false;
        return -6;
    }

    const std::string library_name = JStringResultToStdString(env, library_name_value);
    if (library_name_value != nullptr) {
        env->DeleteLocalRef(library_name_value);
    }
    if (library_name.empty()) {
        g_state.last_error = "Natives.getLibraryName returned an empty library name";
        g_state.init_succeeded = false;
        return -7;
    }

    // addSIscangetName() expects the same native runtime bootstrap that the
    // Juggluco app performs during startup. Without this, vendor globals such
    // as sensors/backup can still be null and registration can SIGSEGV.
    StartSensorsFn start_sensors_fn =
        ResolveSymbolLocked<StartSensorsFn>(kStartSensorsSymbol);
    StartMealsFn start_meals_fn =
        ResolveSymbolLocked<StartMealsFn>(kStartMealsSymbol);
    StartThreadsFn start_threads_fn =
        ResolveSymbolLocked<StartThreadsFn>(kStartThreadsSymbol);
    if (start_sensors_fn == nullptr || start_meals_fn == nullptr || start_threads_fn == nullptr) {
        g_state.init_succeeded = false;
        return -8;
    }

    LOGI("Bootstrapping vendor runtime via startsensors/startmeals/startthreads");
    start_sensors_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.startsensors")) {
        g_state.init_succeeded = false;
        return -9;
    }

    start_meals_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.startmeals")) {
        g_state.init_succeeded = false;
        return -10;
    }

    start_threads_fn(env, vendor_class);
    if (CaptureJavaExceptionLocked(env, "Natives.startthreads")) {
        g_state.init_succeeded = false;
        return -11;
    }

    SetLocaleFn set_locale_fn = ResolveSymbolLocked<SetLocaleFn>(kSetLocaleSymbol);
    if (set_locale_fn != nullptr) {
        // The exported setlocale symbol is present, but the exact locale string
        // format and lifecycle from Juggluco source were not established for
        // this slice. Glucore bootstrap therefore stays on setfilesdir only.
        LOGI("Detected Natives.setlocale but not invoking it in this bridge slice");
    }

    return result;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_getLastError(
    JNIEnv* env,
    jclass clazz
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    return env->NewStringUTF(g_state.last_error.c_str());
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_registerSensor(
    JNIEnv* env,
    jclass clazz,
    jstring barcode,
    jint subtype
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    jclass vendor_class = GetVendorNativesClassLocked(env);
    if (vendor_class == nullptr) {
        return MakeJsonError(env, BridgeUnavailableMessageLocked("registerSensor"));
    }

    AddSiScanGetNameFn add_scan_fn =
        RequireInitializedSymbolLocked<AddSiScanGetNameFn>(kAddSiScanGetNameSymbol);
    Str2SensorPtrFn str2sensorptr_fn =
        RequireInitializedSymbolLocked<Str2SensorPtrFn>(kStr2SensorPtrSymbol);
    SensorPtr2StrFn sensorptr2str_fn =
        RequireInitializedSymbolLocked<SensorPtr2StrFn>(kSensorPtr2StrSymbol);
    if (add_scan_fn == nullptr || str2sensorptr_fn == nullptr || sensorptr2str_fn == nullptr) {
        return MakeJsonError(env, BridgeUnavailableMessageLocked("registerSensor"));
    }

    jintArray index_holder = env->NewIntArray(1);
    if (index_holder == nullptr) {
        g_state.last_error = "Unable to allocate native scan index holder";
        return MakeJsonError(env, g_state.last_error);
    }

    const jint initial_index = -1;
    env->SetIntArrayRegion(index_holder, 0, 1, &initial_index);
    if (CaptureJavaExceptionLocked(env, "SetIntArrayRegion(register index)")) {
        env->DeleteLocalRef(index_holder);
        return MakeJsonError(env, g_state.last_error);
    }

    jstring native_sensor_name_value = add_scan_fn(env, vendor_class, barcode, index_holder);
    if (CaptureJavaExceptionLocked(env, "Natives.addSIscangetName")) {
        env->DeleteLocalRef(index_holder);
        return MakeJsonError(env, g_state.last_error);
    }

    jint native_index = -1;
    env->GetIntArrayRegion(index_holder, 0, 1, &native_index);
    if (CaptureJavaExceptionLocked(env, "GetIntArrayRegion(register index)")) {
        if (native_sensor_name_value != nullptr) {
            env->DeleteLocalRef(native_sensor_name_value);
        }
        env->DeleteLocalRef(index_holder);
        return MakeJsonError(env, g_state.last_error);
    }
    env->DeleteLocalRef(index_holder);

    const std::string native_sensor_name = JStringResultToStdString(env, native_sensor_name_value);
    if (native_sensor_name_value != nullptr) {
        env->DeleteLocalRef(native_sensor_name_value);
    }
    if (native_sensor_name.empty()) {
        g_state.last_error = "Natives.addSIscangetName returned no sensor name";
        return MakeJsonError(env, g_state.last_error);
    }

    jstring native_sensor_name_arg = env->NewStringUTF(native_sensor_name.c_str());
    if (native_sensor_name_arg == nullptr) {
        g_state.last_error = "Unable to allocate sensor name bridge string";
        return MakeJsonError(env, g_state.last_error);
    }

    jlong sensor_ptr = str2sensorptr_fn(env, vendor_class, native_sensor_name_arg);
    env->DeleteLocalRef(native_sensor_name_arg);
    if (CaptureJavaExceptionLocked(env, "Natives.str2sensorptr(register)")) {
        return MakeJsonError(env, g_state.last_error);
    }

    if (sensor_ptr == 0) {
        if (!TryGetPrimarySensorPtrLocked(env, vendor_class, &sensor_ptr)) {
            return MakeJsonError(env, g_state.last_error);
        }
    }
    if (sensor_ptr == 0) {
        g_state.last_error = "Natives registration returned no sensor pointer";
        return MakeJsonError(env, g_state.last_error);
    }

    // The Juggluco sensor store recognizes multiple brands from the same scan
    // string (Sibionics 0x10, Accu-Chek 0x20, ...). The SI subtype only exists
    // on Sibionics sensors, so applying it to another brand would corrupt its
    // record — query the type first and gate the call.
    int libre_version = -1;
    GetSensorPtrLibreVersionFn get_sensorptr_libre_version_fn =
        RequireInitializedSymbolLocked<GetSensorPtrLibreVersionFn>(kGetSensorPtrLibreVersionSymbol);
    if (get_sensorptr_libre_version_fn != nullptr) {
        const jint version = get_sensorptr_libre_version_fn(env, vendor_class, sensor_ptr);
        if (!CaptureJavaExceptionLocked(env, "Natives.getSensorptrLibreVersion")) {
            libre_version = static_cast<int>(version);
        }
    }

    if (libre_version < 0 || libre_version == 0x10) {
        SetSensorPtrSiSubtypeFn set_sensorptr_si_subtype_fn =
            RequireInitializedSymbolLocked<SetSensorPtrSiSubtypeFn>(kSetSensorPtrSiSubtypeSymbol);
        if (set_sensorptr_si_subtype_fn != nullptr) {
            set_sensorptr_si_subtype_fn(env, vendor_class, sensor_ptr, subtype);
            if (CaptureJavaExceptionLocked(env, "Natives.setSensorptrSiSubtype")) {
                return MakeJsonError(env, g_state.last_error);
            }
        }
    }

    jstring canonical_sensor_id_value = sensorptr2str_fn(env, vendor_class, sensor_ptr);
    if (CaptureJavaExceptionLocked(env, "Natives.sensorptr2str(register)")) {
        return MakeJsonError(env, g_state.last_error);
    }

    std::string sensor_id = JStringResultToStdString(env, canonical_sensor_id_value);
    if (canonical_sensor_id_value != nullptr) {
        env->DeleteLocalRef(canonical_sensor_id_value);
    }
    if (sensor_id.empty()) {
        sensor_id = JStringToStdString(env, barcode);
    }

    const std::string payload = BuildSessionJson(
        sensor_id,
        false,
        "tk.glucodata.Natives.addSIscangetName",
        native_sensor_name,
        "",
        "",
        subtype,
        native_index,
        sensor_ptr,
        libre_version
    );
    return MakeJsonSuccess(env, payload);
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_restoreActiveSensor(
    JNIEnv* env,
    jclass clazz
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    jclass vendor_class = GetVendorNativesClassLocked(env);
    if (vendor_class == nullptr) {
        return MakeJsonError(env, BridgeUnavailableMessageLocked("restoreActiveSensor"));
    }

    if (RequireInitializedSymbolLocked<ActiveSensorsFn>(kActiveSensorsSymbol) == nullptr) {
        return MakeJsonError(env, BridgeUnavailableMessageLocked("restoreActiveSensor"));
    }

    std::string sensor_id;
    // Device validation showed activeSensorPtrs can SIGSEGV during startup restore.
    // Keep restore on the safer string-based activeSensors surface until the
    // pointer-based vendor calls are proven safe on-device.
    if (!TryGetPrimaryActiveSensorIdLocked(env, vendor_class, &sensor_id)) {
        return MakeJsonError(env, g_state.last_error);
    }
    if (sensor_id.empty()) {
        return MakeJsonSuccess(env, "{\"status\":\"none\",\"active\":false}");
    }

    const std::string payload = BuildSessionJson(
        sensor_id,
        false,
        "tk.glucodata.Natives.activeSensors"
    );
    return MakeJsonSuccess(env, payload);
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_saveMatchedDevice(
    JNIEnv* env,
    jclass clazz,
    jstring sensorId,
    jstring deviceName,
    jstring macAddress
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    LOGE("%s", "saveMatchedDevice remains unsupported in the current tk.glucodata.Natives bridge slice");
    return JNI_FALSE;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_getInitialWrite(
    JNIEnv* env,
    jclass clazz,
    jstring sensorId
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    return MakeJsonError(
        env,
        "getInitialWrite is not mapped in the current tk.glucodata.Natives bridge slice"
    );
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_berdegeus_glucore_GlucoreSibionicsBridge_handleNotification(
    JNIEnv* env,
    jclass clazz,
    jstring sensorId,
    jbyteArray payload,
    jlong timestampMs
) {
    std::lock_guard<std::mutex> lock(g_state.mutex);

    return MakeJsonError(
        env,
        "handleNotification is not mapped in the current tk.glucodata.Natives bridge slice"
    );
}
