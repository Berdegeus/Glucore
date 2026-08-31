import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme/glucore_colors.dart';
import '../features/auth/presentation/cubit/auth_state.dart';
import '../features/patient/domain/entities/patient_entities.dart';
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
      case AuthError.emailAlreadyExists:
        return l10n.registerEmailAlreadyExistsError;
      case AuthError.weakPassword:
        // Same sentence the define-password fields show as helper text, so the
        // rule is stated identically wherever it is refused.
        return l10n.passwordPolicyHint;
      case AuthError.serviceUnavailable:
        return l10n.authServiceUnavailableError;
      case AuthError.networkError:
        return l10n.authNetworkError;
      case AuthError.serverError:
        return l10n.authServerError;
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

extension AppAlertTypeLocalization on AppAlertType {
  String title(AppLocalizations l10n) {
    switch (this) {
      case AppAlertType.glucoseLow:
        return l10n.alertTypeGlucoseLowTitle;
      case AppAlertType.glucoseHigh:
        return l10n.alertTypeGlucoseHighTitle;
      case AppAlertType.sensorReconnected:
        return l10n.alertTypeSensorReconnectedTitle;
      case AppAlertType.syncFailure:
        return l10n.alertTypeSyncFailureTitle;
    }
  }

  String message(AppLocalizations l10n) {
    switch (this) {
      case AppAlertType.glucoseLow:
        return l10n.alertTypeGlucoseLowMessage;
      case AppAlertType.glucoseHigh:
        return l10n.alertTypeGlucoseHighMessage;
      case AppAlertType.sensorReconnected:
        return l10n.alertTypeSensorReconnectedMessage;
      case AppAlertType.syncFailure:
        return l10n.alertTypeSyncFailureMessage;
    }
  }

  Color color(BuildContext context) {
    final colors = context.glucoreColors;
    switch (this) {
      case AppAlertType.glucoseLow:
        return colors.warningLow;
      case AppAlertType.glucoseHigh:
        return colors.warningHigh;
      case AppAlertType.sensorReconnected:
        return colors.brandPrimary;
      case AppAlertType.syncFailure:
        return colors.zoneLowBg;
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
      case SensorConnectionStatus.pairing:
        return l10n.sensorStatusPairing;
      case SensorConnectionStatus.connected:
        return l10n.sensorStatusConnected;
      case SensorConnectionStatus.syncingHistory:
        return l10n.sensorStatusSyncingHistory;
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
    return this.message;
  }
}
