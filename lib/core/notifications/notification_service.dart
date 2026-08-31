import 'dart:developer';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../l10n/l10n.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();

  static const _sensorChannelId = 'sensor_status';

  Future<void> init() async {
    final l10n = currentAppLocalizations();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(settings: const InitializationSettings(android: android));
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          AndroidNotificationChannel(
            _sensorChannelId,
            l10n.monitoringSensorDisconnectedTitle,
            description: l10n.notificationSensorChannelDescription,
            importance: Importance.high,
          ),
        );
    log('NotificationService initialized', name: 'Notifications');
  }

  Future<void> showSensorDisconnected() {
    final l10n = currentAppLocalizations();
    return _show(
      id: 1,
      title: l10n.monitoringSensorDisconnectedTitle,
      body: l10n.notificationSensorDisconnectedBody,
    );
  }

  Future<void> showGlucoseLow(double value) {
    final l10n = currentAppLocalizations();
    return _show(
      id: 2,
      title: l10n.notificationGlucoseLowTitle(value.toStringAsFixed(0)),
      body: l10n.notificationGlucoseLowBody,
    );
  }

  Future<void> showGlucoseHigh(double value) {
    final l10n = currentAppLocalizations();
    return _show(
      id: 3,
      title: l10n.notificationGlucoseHighTitle(value.toStringAsFixed(0)),
      body: l10n.notificationGlucoseHighBody,
    );
  }

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
            currentAppLocalizations().monitoringSensorDisconnectedTitle,
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
