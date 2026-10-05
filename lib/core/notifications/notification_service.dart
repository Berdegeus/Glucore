import 'dart:developer';
import 'dart:ui';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../l10n/generated/app_localizations.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();

  // No BuildContext here, so the strings come from the generated lookup. The
  // app calls [useLocale] when its locale resolves; until then the device
  // locale (falling back to the first supported one) is used.
  AppLocalizations _l10n = _lookup(PlatformDispatcher.instance.locale);

  static AppLocalizations _lookup(Locale locale) {
    final supported = AppLocalizations.supportedLocales;
    final match = supported.firstWhere(
      (l) => l.languageCode == locale.languageCode,
      orElse: () => supported.first,
    );
    return lookupAppLocalizations(match);
  }

  void useLocale(Locale locale) => _l10n = _lookup(locale);

  static const _sensorChannelId = 'sensor_status';

  Future<void> init() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(settings: const InitializationSettings(android: android));
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          AndroidNotificationChannel(
            _sensorChannelId,
            _l10n.notificationChannelName,
            description: _l10n.notificationChannelDescription,
            importance: Importance.high,
          ),
        );
    log('NotificationService initialized', name: 'Notifications');
  }

  Future<void> showSensorDisconnected() => _show(
    id: 1,
    title: _l10n.monitoringSensorDisconnectedTitle,
    body: _l10n.notificationSensorDisconnectedBody,
  );

  Future<void> showGlucoseLow(double value) => _show(
    id: 2,
    title: _l10n.notificationGlucoseLowTitle(value.toStringAsFixed(0)),
    body: _l10n.notificationGlucoseLowBody,
  );

  Future<void> showGlucoseHigh(double value) => _show(
    id: 3,
    title: _l10n.notificationGlucoseHighTitle(value.toStringAsFixed(0)),
    body: _l10n.notificationGlucoseHighBody,
  );

  Future<void> _show({
    required int id,
    required String title,
    required String body,
  }) async {
    try {
      await _plugin.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _sensorChannelId,
            _l10n.notificationChannelName,
            importance: Importance.high,
            priority: Priority.high,
          ),
        ),
      );
    } catch (e) {
      log('Notification error: $e', name: 'Notifications');
    }
  }
}
