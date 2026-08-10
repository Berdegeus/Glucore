package com.berdegeus.glucore

/**
 * Reassembles the Libre 2 glucose packet from its three BLE notification
 * fragments (20 + 18 + 8 = 46 bytes, in order). Fragments out of sequence
 * reset the assembly, matching Juggluco's pack1/pack2 flags.
 */
class Libre2PacketAssembler {

    companion object {
        const val PACKET_SIZE = 46
        const val FRAGMENT_1_SIZE = 20
        const val FRAGMENT_2_SIZE = 18
        const val FRAGMENT_3_SIZE = 8
    }

    private val packet = ByteArray(PACKET_SIZE)
    private var pack1 = false
    private var pack2 = false

    /**
     * Feeds one notification fragment. Returns the complete 46-byte packet
     * when the third fragment closes the sequence, null otherwise.
     */
    fun offer(value: ByteArray): ByteArray? {
        when (value.size) {
            FRAGMENT_1_SIZE -> {
                System.arraycopy(value, 0, packet, 0, FRAGMENT_1_SIZE)
                pack1 = true
                pack2 = false
            }
            FRAGMENT_2_SIZE -> {
                if (pack1) {
                    System.arraycopy(value, 0, packet, FRAGMENT_1_SIZE, FRAGMENT_2_SIZE)
                    pack2 = true
                }
            }
            FRAGMENT_3_SIZE -> {
                if (pack1 && pack2) {
                    pack1 = false
                    pack2 = false
                    System.arraycopy(
                        value, 0, packet,
                        FRAGMENT_1_SIZE + FRAGMENT_2_SIZE, FRAGMENT_3_SIZE
                    )
                    return packet.copyOf()
                }
            }
        }
        return null
    }

    fun reset() {
        pack1 = false
        pack2 = false
    }
}
