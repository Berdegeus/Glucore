import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_form_layout.dart';

/// Spec: TCC-15 / spec.md "P3: Identidade visual e responsividade" AC4 and AC5 —
/// above 600 dp a form is centred with a maximum width of 560 dp; at 600 dp or
/// less the layout stays single column, unchanged.
const _childKey = Key('form-child');

Future<void> _pumpAtWidth(WidgetTester tester, double width) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Align(
        alignment: Alignment.topLeft,
        child: SizedBox(
          width: width,
          child: const GlucoreFormLayout(
            // Stands in for a form column, which stretches to the width it is
            // offered.
            child: SizedBox(key: _childKey, width: double.infinity, height: 24),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('at 800 dp the form is 560 dp wide and centred', (tester) async {
    await _pumpAtWidth(tester, 800);

    expect(tester.getSize(find.byKey(_childKey)).width, 560);
    expect(tester.getCenter(find.byKey(_childKey)).dx, 400);
  });

  testWidgets('at 400 dp the form takes the full width', (tester) async {
    await _pumpAtWidth(tester, 400);

    expect(tester.getSize(find.byKey(_childKey)).width, 400);
  });

  testWidgets('at exactly 600 dp the form still takes the full width',
      (tester) async {
    await _pumpAtWidth(tester, 600);

    expect(tester.getSize(find.byKey(_childKey)).width, 600);
  });
}
