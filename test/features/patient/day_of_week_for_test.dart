import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/insulin_entry.dart';

/// The insulin forms no longer ask for the weekday: it is always the weekday of
/// the chosen date/time, in the same form the diary and the backend already use.
void main() {
  test('maps every weekday of a known week to its kDaysOfWeek name', () {
    // 2026-10-05 is a Monday.
    final monday = DateTime(2026, 10, 5, 8, 30);
    for (var i = 0; i < 7; i++) {
      expect(dayOfWeekFor(monday.add(Duration(days: i))), kDaysOfWeek[i]);
    }
  });

  test('uses the chosen date, not the time of day', () {
    expect(dayOfWeekFor(DateTime(2026, 10, 4, 0, 1)), 'Domingo');
    expect(dayOfWeekFor(DateTime(2026, 10, 4, 23, 59)), 'Domingo');
    expect(dayOfWeekFor(DateTime(2026, 10, 5, 0, 0)), 'Segunda-feira');
  });
}
