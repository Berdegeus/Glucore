# NOTICE: Juggluco-Derived Native Sibionics Integration

Glucore's Android Sibionics path includes proprietary native libraries packaged
inside the Android app. The Flutter app and shared Dart layers do not use these
libraries directly.

This Android-native integration code is Glucore-owned code that:
- boots a minimal JNI bridge at app startup
- isolates native/proprietary details behind Kotlin adapters
- keeps the Flutter contract limited to Android platform channels and typed session events

## Provenance

Parts of the Android Sibionics native integration approach are derived from the
Juggluco Sibionics implementation path.

The packaged vendor libraries currently expected by the bridge bootstrap path are:
- `libnative.so`
- `libg.so`
- `libinit.so`
- `libdata-handle-lib.so`
- `libnative-struct2json.so`
- `libnative-algorithm-jni-v115G.so`
- `libnative-algorithm-jni-v116A.so`
- `libnative-algorithm-v1_1_5G.so`
- `libnative-algorithm-v1_1_6A.so`
- `libnative-encrypy-decrypt-v110.so`
- `libnative-sensitivity-v110.so`
- `libCALCULATION.so`
- `libcalibrat2.so`
- `libcrl_dp.so`
- `liblibre3extension.so`

These files are currently stored under:
- `android/app/src/main/jniLibs/arm64-v8a/`

## Scope

This proprietary/native dependency is isolated Android integration code for the
Sibionics path. It is not general Flutter application logic and it is not
intended to leak into the Dart/domain/presentation layers.

## Current bootstrap slice

The current Glucore bootstrap slice wires the native bridge into the live
Android path for:
- bridge initialization at startup
- native-backed sensor registration
- native-backed active-session restore

Warmup and glucose monitoring remain timer-simulated in `SensorPlatformImpl`
until the next slice wires real BLE/GATT flow through `SibionicsBleManager`.

Native vendor return payloads are still treated as partially untrusted until
they are validated in device builds against the packaged proprietary binaries.
