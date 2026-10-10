package com.berdegeus.glucore

/** Classification of the status code that accompanies a GATT disconnect. */
object GattStatus {
    private const val CONN_TIMEOUT = 8        // supervision timeout: peer went out of range
    private const val CONN_TERMINATE_PEER = 19 // peer ended the link
    private const val CONN_TERMINATE_LOCAL = 22 // local host ended the link
    private const val CONN_LMP_TIMEOUT = 34   // link-layer response timeout

    /**
     * True when the link was simply lost (out of range, sensor dropped it).
     * That is an expected, recoverable event handled by reconnect, not a
     * failure to report to the user.
     */
    fun isLinkLoss(status: Int): Boolean =
        status == CONN_TIMEOUT ||
            status == CONN_TERMINATE_PEER ||
            status == CONN_TERMINATE_LOCAL ||
            status == CONN_LMP_TIMEOUT
}
