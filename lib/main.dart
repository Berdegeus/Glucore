import 'package:flutter/material.dart';
import 'app.dart';
import 'core/notifications/notification_service.dart';
import 'injection_container.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initDependencies();
  await NotificationService.instance.init();
  runApp(const App());
}
