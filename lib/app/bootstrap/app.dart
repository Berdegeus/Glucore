import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../features/sensor/data/platform/sensor_platform.dart';
import '../../features/sensor/data/repositories/android_sensor_repository.dart';
import '../../features/sensor/presentation/controller/sensor_controller.dart';
import '../../features/sensor/presentation/pages/sensor_page.dart';

class GlucoreApp extends StatefulWidget {
  const GlucoreApp({super.key});

  @override
  State<GlucoreApp> createState() => _GlucoreAppState();
}

class _GlucoreAppState extends State<GlucoreApp> {
  late SensorController _controller;
  late AndroidSensorRepository _repository;

  @override
  void initState() {
    super.initState();
    _initializeController();
  }

  void _initializeController() {
    // Use Android native plugin repository
    final platformService = SensorPlatform();
    _repository = AndroidSensorRepository(platform: platformService);
    _controller = SensorController(repository: _repository);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Glucore MVP',
      theme: ThemeData(primarySwatch: Colors.deepPurple),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: SensorPage(controller: _controller),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _repository.dispose();
    super.dispose();
  }
}
