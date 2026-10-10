import 'package:shared_preferences/shared_preferences.dart';

import '../../../patient/domain/sensor_backfill.dart';

/// Quanto do armazenamento da lib do sensor o app recupera.
///
/// Vive em `SharedPreferences` (preferência de UI deste aparelho, como o tema):
/// define o que este celular importa do sensor, não é dado clínico nem vai para
/// o servidor. Falha de leitura ou valor desconhecido cai no padrão.
class SensorBackfillPreferenceStore {
  const SensorBackfillPreferenceStore();

  static const key = 'sensor_backfill_window';

  Future<SensorBackfillWindow> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return SensorBackfillWindow.fromWireName(prefs.getString(key));
    } catch (_) {
      return SensorBackfillWindow.defaultWindow;
    }
  }

  Future<void> write(SensorBackfillWindow window) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, window.wireName);
  }
}
