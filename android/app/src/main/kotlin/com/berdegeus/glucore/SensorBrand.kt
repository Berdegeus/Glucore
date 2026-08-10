package com.berdegeus.glucore

/**
 * CGM sensor brand supported by the app.
 *
 * [libreVersionCode] mirrors the type code returned by
 * `Natives.getLibreVersion`/`getSensorptrLibreVersion` (Juggluco convention):
 * 0x10 = Sibionics, 0x20 = Accu-Chek SmartGuide, 0x40 = Dexcom, 3 = Libre 3,
 * anything else = Libre 1/2. Libre 2 therefore has no single code and is the
 * fallback.
 */
enum class SensorBrand(val wireName: String, val libreVersionCode: Int?) {
    SIBIONICS("sibionics", 0x10),
    ACCUCHEK("accuchek", 0x20),
    LIBRE2("libre2", null);

    companion object {
        fun fromLibreVersion(code: Int): SensorBrand = when (code) {
            0x10 -> SIBIONICS
            0x20 -> ACCUCHEK
            else -> LIBRE2
        }

        fun fromWireName(name: String?): SensorBrand =
            entries.firstOrNull { it.wireName == name } ?: SIBIONICS
    }
}
