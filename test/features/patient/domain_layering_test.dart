import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guardas da camada `domain/` do feature `patient` (DOMAIN-01).
///
/// São testes de estrutura porque a AC é estrutural: a entidade tem de morar
/// no domínio e nada pode continuar apontando para o modelo de tela.
void main() {
  final libDir = Directory('lib');
  final dartFiles = libDir
      .listSync(recursive: true)
      .whereType<File>()
      .where((file) => file.path.endsWith('.dart'))
      .toList();

  group('DOMAIN-01: entidades do paciente no domain', () {
    test('o modelo de tela não existe mais', () {
      expect(
        File(
          'lib/features/patient/presentation/models/patient_models.dart',
        ).existsSync(),
        isFalse,
      );
    });

    test('nenhum arquivo de lib importa presentation/models', () {
      final offenders = dartFiles
          .where(
            (file) => file.readAsStringSync().contains('patient_models.dart'),
          )
          .map((file) => file.path)
          .toList();
      expect(offenders, isEmpty);
    });

    test('o barrel exporta as cinco entidades do paciente', () {
      final barrel = File(
        'lib/features/patient/domain/entities/patient_entities.dart',
      ).readAsStringSync();
      expect(
        barrel,
        stringContainsInOrder([
          "export 'alert_settings_model.dart';",
          "export 'app_alert_item.dart';",
          "export 'carb_entry.dart';",
          "export 'glucose_reading_item.dart';",
          "export 'insulin_entry.dart';",
        ]),
      );
    });
  });
}
