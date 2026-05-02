import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/app/bootstrap/app.dart';

void main() {
  testWidgets('App launches smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const GlucoreApp());
    await tester.pumpAndSettle();
    expect(find.text('Glucore Sensor'), findsOneWidget);
  });
}
