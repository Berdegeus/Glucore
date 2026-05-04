import 'dart:developer';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();

  static const _sensorChannelId = 'sensor_status';
  static const _sensorChannelName = 'Status do Sensor';

  Future<void> init() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(settings: const InitializationSettings(android: android));
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _sensorChannelId,
            _sensorChannelName,
            description: 'Alertas de conexão do sensor CGM',
            importance: Importance.high,
          ),
        );
    log('NotificationService initialized', name: 'Notifications');
  }

  Future<void> showSensorDisconnected() => _show(
        id: 1,
        title: 'Sensor desconectado',
        body: 'O sensor CGM perdeu a conexão. Toque para reconectar.',
      );

  Future<void> showGlucoseLow(double value) => _show(
        id: 2,
        title: 'Glicose baixa: ${value.toStringAsFixed(0)} mg/dL',
        body: 'Atenção: valor abaixo do limite configurado.',
      );

  Future<void> showGlucoseHigh(double value) => _show(
        id: 3,
        title: 'Glicose alta: ${value.toStringAsFixed(0)} mg/dL',
        body: 'Atenção: valor acima do limite configurado.',
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
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            _sensorChannelId,
            _sensorChannelName,
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
