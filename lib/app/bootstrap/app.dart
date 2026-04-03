import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../core/theme/app_theme.dart';
import '../../features/sensor/data/data_sources/fake_sensor_repository.dart';
import '../../features/sensor/presentation/controller/sensor_controller.dart';
import '../../features/sensor/presentation/pages/sensor_page.dart';

class GlucoreApp extends StatelessWidget {
  const GlucoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = SensorController(repository: FakeSensorRepository());

    return MaterialApp(
      onGenerateTitle: (context) => context.l10n.appName,
      theme: AppTheme.light(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: SensorPage(controller: controller),
    );
  }
}
