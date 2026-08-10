package com.berdegeus.glucore

import android.content.Context
import android.util.Log
import tk.glucodata.Natives
import java.io.File
import java.util.zip.ZipFile

/**
 * Installs Abbott's proprietary algorithm library, which libg.so dlopens
 * itself to decode Libre 1/2 data. The user supplies a LibreLink APK; the
 * entry named by `Natives.getLibraryName()` is extracted to
 * `filesDir/libcalibrate.so` (same convention as Juggluco's getlibrary) and
 * activated via `Natives.abbottreinit()`.
 */
class AbbottLibraryInstaller(private val context: Context) {

    companion object {
        private const val TAG = "AbbottLibraryInstaller"
        private const val TARGET_FILE_NAME = "libcalibrate.so"
    }

    data class Status(val installed: Boolean, val libraryName: String)

    private val targetFile: File get() = File(context.filesDir, TARGET_FILE_NAME)

    fun status(): Status {
        val libraryName = try { Natives.getLibraryName().orEmpty() } catch (e: Throwable) {
            Log.e(TAG, "getLibraryName failed: ${e.message}")
            ""
        }
        val installed = try {
            Natives.gethaslibrary() && targetFile.exists()
        } catch (e: Throwable) {
            Log.e(TAG, "gethaslibrary failed: ${e.message}")
            false
        }
        return Status(installed, libraryName)
    }

    /**
     * Extracts the algorithm library from [apkPath] (a LibreLink APK or split
     * APK) into the app files dir and re-initializes the Abbott runtime.
     */
    fun installFromApk(apkPath: String): Result<Unit> {
        val apk = File(apkPath)
        if (!apk.canRead()) {
            return Result.failure(Exception("Cannot read file: $apkPath"))
        }
        val libraryName = try { Natives.getLibraryName().orEmpty() } catch (e: Throwable) {
            return Result.failure(Exception("Native library name unavailable: ${e.message}"))
        }
        if (libraryName.isBlank()) {
            return Result.failure(Exception("Native layer did not provide a library name"))
        }

        return try {
            ZipFile(apk).use { zip ->
                // Prefer the exact entry name libg expects; fall back to any
                // ABI folder carrying the same basename (split APKs).
                val baseName = libraryName.substringAfterLast('/')
                val entry = zip.getEntry(libraryName)
                    ?: zip.entries().asSequence().firstOrNull {
                        !it.isDirectory && it.name.endsWith("/$baseName")
                    }
                    ?: return Result.failure(
                        Exception("'$baseName' not found in this APK — use the LibreLink APK (arm64)")
                    )

                Log.i(TAG, "Extracting ${entry.name} (${entry.size} bytes) to ${targetFile.path}")
                zip.getInputStream(entry).use { input ->
                    targetFile.outputStream().use { output -> input.copyTo(output) }
                }
            }

            val ok = try { Natives.abbottreinit() } catch (e: Throwable) {
                Log.e(TAG, "abbottreinit threw: ${e.message}")
                false
            }
            val has = ok && try { Natives.gethaslibrary() } catch (_: Throwable) { false }
            if (!has) {
                targetFile.delete()
                try { Natives.sethaslibrary(false) } catch (_: Throwable) {}
                return Result.failure(
                    Exception("The library was extracted but rejected by the native layer")
                )
            }
            Result.success(Unit)
        } catch (e: Exception) {
            targetFile.delete()
            Result.failure(Exception("Failed to install library: ${e.message}", e))
        }
    }
}
