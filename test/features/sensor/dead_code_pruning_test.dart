import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sensor/domain/models.dart';

/// Guardas da poda do fluxo de transmissor (DEAD-02).
///
/// São testes de estrutura porque a AC é estrutural: o requisito é ausência.
/// O teste independente da spec é literalmente uma busca — "busca por
/// `submitTransmitter` não retorna nada em `lib/`" —, então é isso que se
/// automatiza aqui, no mesmo formato de `domain_layering_test.dart`.
void main() {
  group('DEAD-02: fluxo de transmissor fora do Dart', () {
    test('nenhum arquivo de lib menciona transmissor', () {
      final offenders = Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where(
            (file) =>
                file.path.endsWith('.dart') || file.path.endsWith('.arb'),
          )
          .where(
            (file) =>
                file.readAsStringSync().toLowerCase().contains('transmitter'),
          )
          .map((file) => file.path)
          .toList();
      expect(offenders, isEmpty);
    });

    test('as quatro camadas nomeadas não declaram o método', () {
      const layers = {
        'plataforma': 'lib/features/sensor/data/platform/sensor_platform.dart',
        'repositório':
            'lib/features/sensor/data/repositories/android_sensor_repository.dart',
        'contrato de domínio':
            'lib/features/sensor/domain/sensor_repository.dart',
        'cubit': 'lib/features/sensor/presentation/cubit/sensor_cubit.dart',
      };
      for (final entry in layers.entries) {
        expect(
          File(entry.value).readAsStringSync(),
          isNot(contains('submitTransmitter')),
          reason: 'submitTransmitter ainda existe na camada ${entry.key}',
        );
      }
    });
  });

  group('DEAD-02: transições de sessão sem estado órfão', () {
    test('o enum de conexão não tem estado de transmissor', () {
      final names = SensorConnectionStatus.values.map((s) => s.name).toList();
      expect(
        names.where((n) => n.toLowerCase().contains('transmitter')),
        isEmpty,
      );
      expect(names, contains('warmingUp'));
    });
  });
}
