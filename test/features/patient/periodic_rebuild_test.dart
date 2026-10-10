import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/presentation/widgets/periodic_rebuild.dart';

void main() {
  testWidgets('rebuilds on every interval, not only when its parent does',
      (tester) async {
    var builds = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: PeriodicRebuild(
          interval: const Duration(seconds: 30),
          builder: (_) {
            builds++;
            return Text('builds: $builds');
          },
        ),
      ),
    );
    expect(builds, 1);

    // The 10-10 incident: a clock-dependent label sat on "18 min atrás" while
    // 12 more minutes went by, because nothing asked it to rebuild.
    await tester.pump(const Duration(seconds: 30));
    expect(builds, 2);
    await tester.pump(const Duration(seconds: 30));
    expect(builds, 3);

    await tester.pump(const Duration(seconds: 10));
    expect(builds, 3, reason: 'nothing between ticks');
  });

  testWidgets('stops ticking once it leaves the tree', (tester) async {
    var builds = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: PeriodicRebuild(
          interval: const Duration(seconds: 30),
          builder: (_) {
            builds++;
            return const SizedBox();
          },
        ),
      ),
    );
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    final before = builds;

    await tester.pump(const Duration(minutes: 5));
    expect(builds, before);
    expect(tester.takeException(), isNull);
  });
}
