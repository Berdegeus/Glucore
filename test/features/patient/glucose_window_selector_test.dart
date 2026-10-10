import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/patient/presentation/widgets/glucose_window_selector.dart';

void main() {
  const options = [1, 3, 6, 12, 24];

  Future<List<int>> pumpSelector(WidgetTester tester, {int selected = 12}) async {
    final picked = <int>[];
    var current = selected;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: Center(
            child: StatefulBuilder(
              builder: (context, setState) => GlucoseWindowSelector(
                options: options,
                selected: current,
                onChanged: (hours) {
                  picked.add(hours);
                  setState(() => current = hours);
                },
              ),
            ),
          ),
        ),
      ),
    );
    return picked;
  }

  testWidgets('lists every window, compactly', (tester) async {
    await pumpSelector(tester);

    for (final hours in options) {
      expect(find.text('${hours}h'), findsOneWidget, reason: '${hours}h');
    }
  });

  testWidgets('tapping an option selects it', (tester) async {
    final picked = await pumpSelector(tester);

    await tester.tap(find.text('3h'));
    await tester.pumpAndSettle();

    expect(picked, [3]);
  });

  testWidgets('tapping the option already selected does nothing', (tester) async {
    final picked = await pumpSelector(tester);

    await tester.tap(find.text('12h'));
    await tester.pumpAndSettle();

    expect(picked, isEmpty);
  });

  testWidgets('dragging along the track steps through the options it crosses',
      (tester) async {
    final picked = await pumpSelector(tester, selected: 24);

    final gesture = await tester.startGesture(tester.getCenter(find.text('24h')));
    await gesture.moveTo(tester.getCenter(find.text('12h')));
    await tester.pump();
    await gesture.moveTo(tester.getCenter(find.text('1h')));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();

    expect(picked.last, 1, reason: 'lands on the option under the finger');
    expect(picked, contains(12), reason: 'crossed 12h on the way');
  });

  testWidgets('dragging past either end clamps to the first or last option',
      (tester) async {
    final picked = await pumpSelector(tester, selected: 6);

    await tester.drag(find.text('6h'), const Offset(-600, 0));
    await tester.pumpAndSettle();
    expect(picked.last, 1);

    await tester.drag(find.text('1h'), const Offset(600, 0));
    await tester.pumpAndSettle();
    expect(picked.last, 24);
  });

  testWidgets('the thumb presses in while a finger is down and releases after',
      (tester) async {
    await pumpSelector(tester);

    double scale() => tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale;
    expect(scale(), 1);

    final gesture = await tester.startGesture(tester.getCenter(find.text('6h')));
    await tester.pump();
    expect(scale(), lessThan(1));

    await gesture.up();
    await tester.pumpAndSettle();
    expect(scale(), 1);
  });

  testWidgets('screen readers get a value and increase/decrease actions',
      (tester) async {
    final handle = tester.ensureSemantics();
    final picked = await pumpSelector(tester, selected: 6);

    final node = tester.getSemantics(find.byType(GlucoseWindowSelector));
    final data = node.getSemanticsData();
    expect(data.value, '6 horas');
    expect(data.hasAction(SemanticsAction.increase), isTrue);
    expect(data.hasAction(SemanticsAction.decrease), isTrue);

    tester.semantics.performAction(
      find.semantics.byLabel('Janela do gráfico'),
      SemanticsAction.increase,
    );
    await tester.pumpAndSettle();
    expect(picked, [12]);
    handle.dispose();
  });
}
