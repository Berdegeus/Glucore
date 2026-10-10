import 'entities/glucose_reading_item.dart';
import 'repositories/patient_repository.dart';

/// How far back to recover readings from the sensor library's own store.
///
/// Never longer than [PatientRepository.readingRetention]: anything older would
/// be dropped by [retainRecentReadings] on the next save.
enum SensorBackfillWindow {
  h24(Duration(hours: 24), 'h24'),
  h48(Duration(hours: 48), 'h48'),
  d7(Duration(days: 7), 'd7'),
  d14(Duration(days: 14), 'd14'),
  off(Duration.zero, 'off');

  const SensorBackfillWindow(this.duration, this.wireName);

  final Duration duration;
  final String wireName;

  static const defaultWindow = SensorBackfillWindow.h48;

  /// Unknown or missing values fall back to [defaultWindow].
  static SensorBackfillWindow fromWireName(String? name) {
    for (final window in values) {
      if (window.wireName == name) return window;
    }
    return defaultWindow;
  }
}

/// Minutes closer than this to an existing reading count as already covered.
/// Live readings carry the sensor time (`:00`) or, as a fallback, the phone
/// time (`:17`), while the library's minutes are 60 s apart.
const backfillTolerance = Duration(seconds: 30);

/// Adds the stored per-minute readings that [existing] lacks.
///
/// Insert-only: an existing reading is never altered or removed. A candidate is
/// skipped when an existing (or already inserted) reading is within
/// [tolerance]. When nothing needs inserting the very same [existing] list is
/// returned, so callers can skip the emit and the save. Otherwise the result is
/// newest-first and trimmed to the retention window once.
List<GlucoseReadingItem> mergeStoredReadings({
  required List<GlucoseReadingItem> existing,
  required List<GlucoseReadingItem> stored,
  Duration tolerance = backfillTolerance,
}) {
  if (stored.isEmpty) return existing;

  final taken = existing.map((r) => r.timestamp.millisecondsSinceEpoch).toList()
    ..sort();
  final toleranceMs = tolerance.inMilliseconds;

  bool covered(int ms) {
    var low = 0;
    var high = taken.length;
    while (low < high) {
      final mid = (low + high) >> 1;
      if (taken[mid] < ms) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    if (low < taken.length && taken[low] - ms < toleranceMs) return true;
    if (low > 0 && ms - taken[low - 1] < toleranceMs) return true;
    return false;
  }

  // Ascending, so overlap among the candidates themselves only needs a look at
  // the last one inserted (a scan of all of them would be O(n²) on 20k rows).
  final ascending = List<GlucoseReadingItem>.of(stored)
    ..sort((a, b) => a.timestamp.compareTo(b.timestamp));
  final inserted = <GlucoseReadingItem>[];
  int? lastInsertedMs;
  for (final candidate in ascending) {
    final ms = candidate.timestamp.millisecondsSinceEpoch;
    if (covered(ms)) continue;
    if (lastInsertedMs != null && ms - lastInsertedMs < toleranceMs) continue;
    inserted.add(candidate);
    lastInsertedMs = ms;
  }
  if (inserted.isEmpty) return existing;

  final merged = <GlucoseReadingItem>[...existing, ...inserted]
    ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
  return retainRecentReadings(merged);
}
