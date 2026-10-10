import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/sensor_backfill.dart';
import 'package:glucore/features/sensor/data/preferences/sensor_backfill_preference_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const store = SensorBackfillPreferenceStore();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('defaults to 48 h when nothing was saved', () async {
    expect(await store.read(), SensorBackfillWindow.h48);
  });

  test('round-trips every window', () async {
    for (final window in SensorBackfillWindow.values) {
      await store.write(window);
      expect(await store.read(), window, reason: window.name);
    }
  });

  test('an unknown stored value falls back to the default', () async {
    SharedPreferences.setMockInitialValues({SensorBackfillPreferenceStore.key: 'forever'});
    expect(await store.read(), SensorBackfillWindow.h48);
  });
}
