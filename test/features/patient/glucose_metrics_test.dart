import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/glucose_metrics.dart';

/// `gmiFromMean` contra `contracts/gmi-cases.json`, a mesma tabela que o teste
/// do backend usa para o `glucose_metrics()` (API-09). Os testes rodam a partir
/// da raiz do repositório.
void main() {
  final cases = (jsonDecode(File('contracts/gmi-cases.json').readAsStringSync())
          as List<dynamic>)
      .cast<Map<String, dynamic>>();

  test('o contrato cobre as médias 80, 120, 154, 183 e 250', () {
    expect(
      cases.map((c) => c['meanMgDl']).toList(),
      [80, 120, 154, 183, 250],
    );
  });

  for (final c in cases) {
    final mean = (c['meanMgDl'] as num).toDouble();
    final expected = (c['gmi'] as num).toDouble();

    test('média $mean mg/dL dá GMI $expected', () {
      expect(gmiFromMean(mean), expected);
    });
  }

  test('a média zero devolve o intercepto da fórmula', () {
    expect(gmiFromMean(0), 3.31);
  });

  test('arredonda para duas casas: 6.58704 vira 6.59', () {
    // 3.31 + 0.02392 x 137.
    expect(gmiFromMean(137), 6.59);
  });
}
