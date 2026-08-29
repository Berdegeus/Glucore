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

    test('o barrel exporta as entidades do paciente', () {
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
          "export 'patient_snapshot.dart';",
        ]),
      );
    });
  });

  group('DOMAIN-02: contrato do repositório no domain', () {
    test('a implementação vive em data/ e assina o contrato do domínio', () {
      expect(
        File(
          'lib/features/patient/data/repositories/patient_repository.dart',
        ).existsSync(),
        isFalse,
      );
      final impl = File(
        'lib/features/patient/data/repositories/patient_repository_impl.dart',
      ).readAsStringSync();
      expect(
        impl,
        contains('class PatientRepositoryImpl implements PatientRepository'),
      );
    });

    test('o domain não importa a camada de dados', () {
      final domainFiles = Directory('lib/features/patient/domain')
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart'));
      final offenders = domainFiles
          .where((file) => file.readAsStringSync().contains("import '../../data/"))
          .map((file) => file.path)
          .toList();
      expect(offenders, isEmpty);
    });

    test('o DI registra a interface, não a implementação', () {
      final di = File('lib/injection_container.dart').readAsStringSync();
      expect(
        di,
        contains('sl.registerLazySingleton<PatientRepository>('),
      );
      expect(di, contains('() => PatientRepositoryImpl('));
    });
  });
}
