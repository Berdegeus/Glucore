import 'package:flutter/material.dart';

import '../../features/sensor/data/data_sources/fake_sensor_repository.dart';
import '../../features/sensor/presentation/controller/sensor_controller.dart';
import '../../features/sensor/presentation/pages/sensor_page.dart';

class GlucoreApp extends StatelessWidget {
  const GlucoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = SensorController(repository: FakeSensorRepository());

    return MaterialApp(
      title: 'Glucore MVP',
      theme: ThemeData(primarySwatch: Colors.deepPurple),
      home: SensorPage(controller: controller),
    );
  }
}
