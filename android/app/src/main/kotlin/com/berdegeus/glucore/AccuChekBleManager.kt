package com.berdegeus.glucore

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import tk.glucodata.Natives
import java.util.UUID

/**
 * Accu-Chek SmartGuide protocol on top of [BrandBleManager] (ported from
 * Juggluco's AccuGattCallback). Standard SIG CGM profile: service 0x181f,
 * measurement notifications on 2aa7, control point 2aac and RACP 2a52 via
 * indications.
 *
 * Security is OS link-layer bonding: reading the encrypted CGM Status
 * characteristic while unbonded makes Android show the system PIN dialog;
 * the handshake resumes once ACTION_BOND_STATE_CHANGED reports BOND_BONDED.
 */
class AccuChekBleManager(
    context: Context,
    onEvent: (Map<String, Any?>) -> Unit
) : BrandBleManager(context, onEvent) {

    companion object {
        private const val READ_RETRY_DELAY_MS = 20L
        private const val READ_RETRY_ATTEMPTS = 16
    }

    override val tag = "AccuChekBleManager"
    override val brandName = "Accu-Chek SmartGuide"
    override val scanServiceUuid: UUID = AccuChekProtocol.CGM_SERVICE

    private var serial: String = ""
    private var phase = 0
    private var isBonded = false
    private var deferredDiscovery = false

    private val characteristics = mutableMapOf<UUID, BluetoothGattCharacteristic>()

    private val measurementChar get() = characteristics[AccuChekProtocol.CGM_MEASUREMENT]
    private val statusChar get() = characteristics[AccuChekProtocol.CGM_STATUS]
    private val controlChar get() = characteristics[AccuChekProtocol.CGM_CONTROL]
    private val racpChar get() = characteristics[AccuChekProtocol.RACP]

    init {
        // Bond state changes arrive as a system broadcast; the receiver lives
        // as long as this (application-scoped) manager, matching Juggluco.
        context.registerReceiver(
            object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    if (intent?.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) return
                    @Suppress("DEPRECATION")
                    val device =
                        intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                            ?: return
                    val state =
                        intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
                    val previous = intent.getIntExtra(
                        BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE,
                        BluetoothDevice.ERROR
                    )
                    mainHandler.post { handleBondStateChanged(device, state, previous) }
                }
            },
            IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
        )
    }

    override fun prepareScan(): Result<Unit> {
        serial = try { Natives.getSensorName(dataptr).orEmpty() } catch (e: Exception) {
            Log.e(tag, "getSensorName failed: ${e.message}")
            ""
        }
        if (serial.isBlank()) {
            return Result.failure(Exception("SmartGuide serial unavailable for device matching"))
        }
        Log.i(tag, "Scanning for SmartGuide with serial suffix: $serial")
        return Result.success(Unit)
    }

    override fun matchDevice(deviceName: String): Boolean =
        AccuChekProtocol.matchesDeviceName(deviceName, serial)

    override fun onBrandConnected(gatt: BluetoothGatt) {
        val bondState = gatt.device.bondState
        isBonded = bondState == BluetoothDevice.BOND_BONDED
        phase = if (isBonded) 2 else 0
        Log.i(tag, "Connected with bondState=$bondState (isBonded=$isBonded)")
    }

    override fun shouldDiscoverServicesOnConnect(gatt: BluetoothGatt): Boolean {
        if (gatt.device.bondState == BluetoothDevice.BOND_BONDING) {
            Log.i(tag, "Bonding in progress; deferring service discovery")
            deferredDiscovery = true
            emitStatus("pairing")
            return false
        }
        return true
    }

    override fun onBrandDisconnected() {
        characteristics.clear()
        phase = 0
        deferredDiscovery = false
    }

    override fun onBrandServicesDiscovered(gatt: BluetoothGatt) {
        characteristics.clear()
        for (service in gatt.services) {
            for (characteristic in service.characteristics) {
                characteristics[characteristic.uuid] = characteristic
            }
        }

        val control = controlChar
        if (control == null || measurementChar == null || statusChar == null || racpChar == null) {
            emitError("SmartGuide CGM characteristics not found on device")
            disconnect()
            return
        }
        setupComplete = true

        if (isBonded) {
            enableMeasurementNotifications(gatt)
        } else {
            // Reading the encrypted status characteristic triggers the OS
            // pairing dialog; the user types the sensor PIN there.
            emitStatus("pairing")
            val status = statusChar ?: return
            tryOrRetry { readCharacteristic(status) }
        }
    }

    override fun onBrandDescriptorWrite(characteristicUuid: UUID, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            emitError("Failed to enable SmartGuide notifications ($status)")
            disconnect()
            return
        }
        val gatt = currentGatt ?: return
        when (characteristicUuid) {
            AccuChekProtocol.CGM_MEASUREMENT -> {
                val racp = racpChar ?: return
                tryOrRetry { enableCharacteristicNotification(gatt, racp, indication = true) }
            }
            AccuChekProtocol.RACP -> {
                val control = controlChar ?: return
                tryOrRetry { enableCharacteristicNotification(gatt, control, indication = true) }
            }
            AccuChekProtocol.CGM_CONTROL -> {
                emitStatus("connected")
                if (isBonded) {
                    val status2 = statusChar ?: return
                    tryOrRetry { readCharacteristic(status2) }
                } else {
                    enqueueWrite(controlChar, AccuChekProtocol.CMD_UNBONDED_BOOTSTRAP)
                }
            }
        }
    }

    override fun onBrandCharacteristicRead(uuid: UUID, value: ByteArray?, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            if (status == BluetoothGatt.GATT_INSUFFICIENT_AUTHENTICATION) {
                // Bonding is being set up by the stack; the read is retried
                // (or reissued from the bond receiver) once bonded.
                Log.i(tag, "Read needs authentication; waiting for bond")
                return
            }
            if (uuid == AccuChekProtocol.CGM_STATUS &&
                pendingDevice?.bondState != BluetoothDevice.BOND_BONDED
            ) {
                Log.w(tag, "CGM status read failed while unbonded (status=$status); waiting for pairing")
                return
            }
            emitError("SmartGuide read failed on $uuid ($status)")
            disconnect()
            return
        }
        val gatt = currentGatt ?: return
        val data = value ?: ByteArray(0)

        when (uuid) {
            AccuChekProtocol.CGM_STATUS -> {
                try { Natives.accuSetStartTime(dataptr, data) } catch (e: Exception) {
                    Log.e(tag, "accuSetStartTime: ${e.message}")
                }
                when (phase) {
                    0 -> readByUuid(gatt, AccuChekProtocol.FIRMWARE_REVISION)
                    1 -> readByUuid(gatt, AccuChekProtocol.CGM_SESSION_START_TIME)
                    else -> enqueueWrite(controlChar, AccuChekProtocol.CMD_START_STREAM)
                }
            }
            AccuChekProtocol.FIRMWARE_REVISION -> readByUuid(gatt, AccuChekProtocol.HARDWARE_REVISION)
            AccuChekProtocol.HARDWARE_REVISION -> readByUuid(gatt, AccuChekProtocol.MANUFACTURER_NAME)
            AccuChekProtocol.MANUFACTURER_NAME -> readByUuid(gatt, AccuChekProtocol.SYSTEM_ID)
            AccuChekProtocol.SYSTEM_ID -> readByUuid(gatt, AccuChekProtocol.MODEL_NUMBER)
            AccuChekProtocol.MODEL_NUMBER -> readByUuid(gatt, AccuChekProtocol.SERIAL_NUMBER)
            AccuChekProtocol.SERIAL_NUMBER -> enableMeasurementNotifications(gatt)
            AccuChekProtocol.CGM_FEATURE -> {
                phase = 1
                readByUuid(gatt, AccuChekProtocol.APPEARANCE)
            }
            AccuChekProtocol.APPEARANCE -> readByUuid(gatt, AccuChekProtocol.CGM_STATUS)
            AccuChekProtocol.CGM_SESSION_START_TIME -> {
                // Juggluco falls through here: kick off the run-time read and
                // already issue the session-info command.
                readByUuid(gatt, AccuChekProtocol.CGM_SESSION_RUN_TIME)
                enqueueWrite(controlChar, AccuChekProtocol.CMD_SESSION_INFO)
            }
            AccuChekProtocol.CGM_SESSION_RUN_TIME ->
                enqueueWrite(controlChar, AccuChekProtocol.CMD_SESSION_INFO)
        }
    }

    override fun onBrandCharacteristicChanged(uuid: UUID, data: ByteArray, timestampMs: Long) {
        when (uuid) {
            AccuChekProtocol.CGM_MEASUREMENT -> processMeasurement(data, timestampMs)
            AccuChekProtocol.CGM_CONTROL -> {
                val gatt = currentGatt ?: return
                if (AccuChekProtocol.isControlAck(data)) {
                    if (!AccuChekProtocol.isExpectedControlAck(data)) {
                        Log.w(tag, "Unexpected control ack: ${data.joinToString { "%02X".format(it) }}")
                    }
                    readByUuid(gatt, AccuChekProtocol.CGM_FEATURE)
                } else if (phase == 1) {
                    phase = 2
                    readByUuid(gatt, AccuChekProtocol.CGM_STATUS)
                } else if (phase == 2) {
                    phase = 3
                    askValues()
                }
            }
        }
    }

    private fun processMeasurement(value: ByteArray, timestampMs: Long) {
        val result = try {
            Natives.accuProcessData(dataptr, value, timestampMs)
        } catch (e: Exception) {
            Log.e(tag, "accuProcessData threw: ${e.message}")
            return
        }
        if (result == 1L) {
            // Native stored a back-filled record without exposing a reading.
            notifyHistoryStored()
            return
        }
        val decoded = decodePackedGlucose(
            packedReading = result,
            timestampMs = timestampMs,
            source = "accuProcessData",
            hasReliableSensorTimestamp = false
        ) ?: return
        deliverReading(decoded)
    }

    /** RACP back-fill request from the last stored record index. */
    private fun askValues() {
        val cmd = try { Natives.accuAskValues(dataptr) } catch (e: Exception) {
            Log.e(tag, "accuAskValues threw: ${e.message}")
            null
        }
        if (cmd == null) {
            emitError("SmartGuide back-fill command unavailable")
            disconnect()
            return
        }
        enqueueWrite(racpChar, cmd)
    }

    private fun handleBondStateChanged(device: BluetoothDevice, state: Int, previousState: Int) {
        assertMainThread()
        val active = pendingDevice ?: return
        if (device.address != active.address) return

        when (state) {
            BluetoothDevice.BOND_BONDING -> emitStatus("pairing")
            BluetoothDevice.BOND_BONDED -> {
                Log.i(tag, "Bonded to ${device.address}")
                isBonded = true
                val gatt = currentGatt ?: return
                if (deferredDiscovery) {
                    deferredDiscovery = false
                    if (!hasBlePermissions() || !gatt.discoverServices()) {
                        emitError("Service discovery could not start after bonding")
                    }
                    return
                }
                // Older stacks do not retry the encrypted read on their own.
                if (Build.VERSION.SDK_INT < 26) {
                    val status = statusChar ?: return
                    tryOrRetry { readCharacteristic(status) }
                }
            }
            BluetoothDevice.BOND_NONE -> {
                if (previousState == BluetoothDevice.BOND_BONDING) {
                    emitError("Pairing with the sensor failed or was cancelled")
                }
            }
        }
    }

    private fun enableMeasurementNotifications(gatt: BluetoothGatt) {
        val measurement = measurementChar ?: return
        tryOrRetry { enableCharacteristicNotification(gatt, measurement) }
    }

    private fun readByUuid(gatt: BluetoothGatt, uuid: UUID) {
        val characteristic = characteristics[uuid]
        if (characteristic == null) {
            Log.w(tag, "Characteristic $uuid not discovered; skipping read")
            return
        }
        tryOrRetry { readCharacteristic(characteristic) }
    }

    /**
     * GATT operations get rejected while another one is in flight; retry a
     * few times on the main handler (Juggluco's `tryer`, 16 × 20 ms).
     */
    private fun tryOrRetry(attemptsLeft: Int = READ_RETRY_ATTEMPTS, action: () -> Boolean) {
        if (action()) return
        if (attemptsLeft <= 0 || currentGatt == null) {
            Log.w(tag, "GATT operation kept failing; giving up after retries")
            return
        }
        mainHandler.postDelayed({ tryOrRetry(attemptsLeft - 1, action) }, READ_RETRY_DELAY_MS)
    }
}
