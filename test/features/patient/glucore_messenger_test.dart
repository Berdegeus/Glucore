import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_messenger.dart';

/// Spec: TCC-06 / spec.md "P2: Mensagens de usuário padronizadas" — one helper
/// with four variants (AC1), told apart by background colour and icon, both
/// taken from AppTheme (AC3).

/// Pumps a screen whose only button shows [message] through [show].
Future<void> _pumpMessenger(
  WidgetTester tester,
  void Function(BuildContext context, String message) show,
  String message,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => show(context, message),
            child: const Text('show'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('show'));
  await tester.pump();
}

SnackBar _snackBar(WidgetTester tester) =>
    tester.widget<SnackBar>(find.byType(SnackBar));

void main() {
  testWidgets('info uses the neutral background and the info icon',
      (tester) async {
    await _pumpMessenger(tester, GlucoreMessenger.info, 'apenas informando');

    expect(find.text('apenas informando'), findsOneWidget);
    expect(_snackBar(tester).backgroundColor, AppTheme.neutralInfo);
    expect(find.byIcon(Icons.info_outline), findsOneWidget);
  });

  testWidgets('warning uses the high zone background and the warning icon',
      (tester) async {
    await _pumpMessenger(tester, GlucoreMessenger.warning, 'atenção');

    expect(find.text('atenção'), findsOneWidget);
    expect(_snackBar(tester).backgroundColor, AppTheme.zoneHighBg);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
  });

  testWidgets('error uses the low zone background and the error icon',
      (tester) async {
    await _pumpMessenger(tester, GlucoreMessenger.error, 'falhou');

    expect(find.text('falhou'), findsOneWidget);
    expect(_snackBar(tester).backgroundColor, AppTheme.zoneLowBg);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
  });

  testWidgets('success uses the target zone background and the success icon',
      (tester) async {
    await _pumpMessenger(tester, GlucoreMessenger.success, 'salvo');

    expect(find.text('salvo'), findsOneWidget);
    expect(_snackBar(tester).backgroundColor, AppTheme.zoneTargetBg);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
  });

  testWidgets('the four variants are told apart by background colour and icon',
      (tester) async {
    // A cor da variante agora sai do tema ativo, então precisa de um
    // BuildContext montado para ser resolvida.
    late BuildContext ctx;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Builder(builder: (context) {
          ctx = context;
          return const SizedBox.shrink();
        }),
      ),
    );

    final backgrounds = GlucoreMessageVariant.values
        .map((variant) => variant.background(ctx))
        .toSet();
    final icons =
        GlucoreMessageVariant.values.map((variant) => variant.icon).toSet();

    expect(backgrounds, hasLength(GlucoreMessageVariant.values.length));
    expect(icons, hasLength(GlucoreMessageVariant.values.length));
  });
}
