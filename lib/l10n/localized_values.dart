import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../features/auth/presentation/cubit/auth_state.dart';
import '../features/patient/presentation/models/patient_models.dart';
import '../features/sensor/domain/models.dart';
import 'l10n.dart';

extension BuildContextFormatting on BuildContext {
  String formatShortDateTime(DateTime value) {
    final locale = Localizations.localeOf(this).toString();
    return DateFormat.yMd(locale).add_Hm().format(value);
  }
}

extension AuthErrorLocalization on AuthError {
  String message(AppLocalizations l10n) {
    switch (this) {
      case AuthError.invalidCredentials:
        return l10n.loginInvalidCredentialsError;
    }
  }
}

extension GlucoseTrendLocalization on GlucoseTrend {
  String label(AppLocalizations l10n) {
    switch (this) {
      case GlucoseTrend.rising:
        return l10n.monitoringTrendRising;
      case GlucoseTrend.stable:
        return l10n.monitoringTrendStable;
      case GlucoseTrend.falling:
        return l10n.monitoringTrendFalling;
    }
  }
}

extension SensorConnectionUiStateLocalization on SensorConnectionUiState {
  String label(AppLocalizations l10n) {
    switch (this) {
      case SensorConnectionUiState.searching:
        return l10n.sensorLinkStatusSearchingLabel;
      case SensorConnectionUiState.permissionPending:
        return l10n.sensorLinkStatusPermissionPendingLabel;
      case SensorConnectionUiState.connected:
        return l10n.sensorLinkStatusConnectedLabel;
      case SensorConnectionUiState.compatibilityError:
        return l10n.sensorLinkStatusCompatibilityErrorLabel;
      case SensorConnectionUiState.reconnecting:
        return l10n.sensorLinkStatusReconnectingLabel;
      case SensorConnectionUiState.unavailable:
        return l10n.sensorLinkStatusUnavailableLabel;
      case SensorConnectionUiState.disconnected:
        return l10n.sensorLinkStatusDisconnectedLabel;
    }
  }
}

extension AppAlertTypeLocalization on AppAlertType {
  String title(AppLocalizations l10n) {
    switch (this) {
      case AppAlertType.imminentHypoRisk:
        return l10n.alertTypeImminentHypoTitle;
      case AppAlertType.sensorReconnected:
        return l10n.alertTypeSensorReconnectedTitle;
    }
  }

  String message(AppLocalizations l10n) {
    switch (this) {
      case AppAlertType.imminentHypoRisk:
        return l10n.alertTypeImminentHypoMessage;
      case AppAlertType.sensorReconnected:
        return l10n.alertTypeSensorReconnectedMessage;
    }
  }
}

extension InsulinTypeLocalization on InsulinType {
  String label(AppLocalizations l10n) {
    switch (this) {
      case InsulinType.bolus:
        return l10n.insulinTypeBolus;
      case InsulinType.basal:
        return l10n.insulinTypeBasal;
      case InsulinType.correction:
        return l10n.insulinTypeCorrection;
    }
  }
}

extension SensorConnectionStatusLocalization on SensorConnectionStatus {
  String label(AppLocalizations l10n) {
    switch (this) {
      case SensorConnectionStatus.idle:
        return l10n.sensorStatusIdle;
      case SensorConnectionStatus.scanning:
        return l10n.sensorStatusScanning;
      case SensorConnectionStatus.connecting:
        return l10n.sensorStatusConnecting;
      case SensorConnectionStatus.connected:
        return l10n.sensorStatusConnected;
      case SensorConnectionStatus.warmingUp:
        return l10n.sensorStatusWarmingUp;
      case SensorConnectionStatus.readingAvailable:
        return l10n.sensorStatusReadingAvailable;
      case SensorConnectionStatus.disconnected:
        return l10n.sensorStatusDisconnected;
      case SensorConnectionStatus.error:
        return l10n.sensorStatusError;
    }
  }
}

extension SensorFailureLocalization on SensorFailure {
  String message(AppLocalizations l10n) {
    switch (code) {
      case SensorFailureCode.invalidSensorBarcode:
        return l10n.sensorFailureInvalidSensorBarcode;
      case SensorFailureCode.invalidTransmitterBarcode:
        return l10n.sensorFailureInvalidTransmitterBarcode;
      case SensorFailureCode.noActiveSensor:
        return l10n.sensorFailureNoActiveSensor;
      case SensorFailureCode.noSensorRegistered:
        return l10n.sensorFailureNoSensorRegistered;
      case SensorFailureCode.unknown:
        return l10n.sensorFailureUnknown;
    }
  }
}
