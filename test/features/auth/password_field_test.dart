import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';

/// Spec: TCC-02 / spec.md P1 AC4, AC5 and AC7 — every password field is a
/// PasswordField, starts obscured, toggles visibility for that field only, and
/// can spell out the strength rule as helper text.
const _firstKey = Key('first-password');
const _secondKey = Key('second-password');

bool _isObscured(WidgetTester tester, Key fieldKey) {
  return tester
      .widget<EditableText>(
        find.descendant(
          of: find.byKey(fieldKey),
          matching: find.byType(EditableText),
        ),
      )
      .obscureText;
}

Future<void> _tapToggle(WidgetTester tester, Key fieldKey) async {
  await tester.tap(
    find.descendant(
      of: find.byKey(fieldKey),
      matching: find.byType(IconButton),
    ),
  );
  await tester.pump();
}

Future<void> _pumpFields(
  WidgetTester tester, {
  String? helperText,
  String? Function(String?)? validator,
  GlobalKey<FormState>? formKey,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Form(
          key: formKey,
          child: Column(
            children: [
              PasswordField(
                key: _firstKey,
                controller: TextEditingController(),
                label: 'Senha',
                helperText: helperText,
                validator: validator,
              ),
              PasswordField(
                key: _secondKey,
                controller: TextEditingController(),
                label: 'Confirmar senha',
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('starts obscured', (tester) async {
    await _pumpFields(tester);

    expect(_isObscured(tester, _firstKey), isTrue);
  });

  testWidgets('tapping the icon reveals the text and tapping again hides it',
      (tester) async {
    await _pumpFields(tester);

    await _tapToggle(tester, _firstKey);
    expect(_isObscured(tester, _firstKey), isFalse);

    await _tapToggle(tester, _firstKey);
    expect(_isObscured(tester, _firstKey), isTrue);
  });

  testWidgets('two fields on the same screen toggle independently',
      (tester) async {
    await _pumpFields(tester);

    await _tapToggle(tester, _firstKey);

    expect(_isObscured(tester, _firstKey), isFalse);
    expect(_isObscured(tester, _secondKey), isTrue);
  });

  testWidgets('shows the injected helper text', (tester) async {
    await _pumpFields(tester, helperText: 'Mínimo de 8 caracteres');

    expect(find.text('Mínimo de 8 caracteres'), findsOneWidget);
  });

  testWidgets('runs the injected validator when the form is submitted',
      (tester) async {
    final formKey = GlobalKey<FormState>();
    final validated = <String?>[];

    await _pumpFields(
      tester,
      formKey: formKey,
      validator: (value) {
        validated.add(value);
        return 'senha recusada';
      },
    );

    await tester.enterText(find.byKey(_firstKey), 'senha123');
    expect(formKey.currentState!.validate(), isFalse);
    await tester.pump();

    expect(validated, contains('senha123'));
    expect(find.text('senha recusada'), findsOneWidget);
  });
}
