import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-05 / spec.md "P1: Obrigatório vs. opcional coerente com o modelo"
/// AC1 — every required field label is suffixed with `*` and every optional one
/// with "(opcional)".
void main() {
  late AppLocalizations l10n;

  setUp(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
  });

  test('marks a required field with a trailing asterisk', () {
    expect(fieldLabel(l10n, 'Peso (kg)', required: true), 'Peso (kg) *');
  });

  test('marks an optional field with the optional suffix', () {
    expect(
      fieldLabel(l10n, 'Peso (kg)', required: false),
      'Peso (kg) (opcional)',
    );
  });

  test('takes the optional suffix from localizations', () {
    expect(l10n.fieldOptionalSuffix, '(opcional)');
    expect(
      fieldLabel(l10n, 'Telefone', required: false),
      'Telefone ${l10n.fieldOptionalSuffix}',
    );
  });
}
