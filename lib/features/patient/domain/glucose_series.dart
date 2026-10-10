import 'entities/glucose_reading_item.dart';

/// Points the chart aims for across its width. More than this on a phone is
/// noise: a 24 h window of one-minute readings is 1440 points in ~300 px.
const chartTargetPoints = 150;

/// Minutes each plotted point covers for a window of [windowHours].
int chartBucketMinutes(int windowHours) {
  final windowMinutes = windowHours * 60;
  final bucket = (windowMinutes / chartTargetPoints).ceil();
  return bucket < 1 ? 1 : bucket;
}

/// Thins [ascending] (oldest first) for plotting by averaging readings that
/// fall in the same [bucketMinutes]-minute bucket.
///
/// The newest reading is always kept as it is, so the dot at the end of the
/// line shows the real current value and not an average that lags behind it.
/// Returns [ascending] untouched when there is nothing to thin or when thinning
/// would leave fewer than two points.
List<GlucoseReadingItem> thinForChart(
  List<GlucoseReadingItem> ascending, {
  required int bucketMinutes,
}) {
  if (bucketMinutes <= 1 || ascending.length < 3) return ascending;

  final origin = ascending.first.timestamp;
  final bucketMs = bucketMinutes * Duration.millisecondsPerMinute;

  final thinned = <GlucoseReadingItem>[];
  var bucketIndex = -1;
  var count = 0;
  var sumValue = 0.0;
  var sumTimeMs = 0;
  GlucoseReadingItem? last;

  void flush() {
    final newest = last;
    if (count == 0 || newest == null) return;
    thinned.add(
      GlucoseReadingItem(
        value: sumValue / count,
        timestamp: DateTime.fromMillisecondsSinceEpoch(sumTimeMs ~/ count),
        trend: newest.trend,
        rate: newest.rate,
        alarmCode: newest.alarmCode,
      ),
    );
  }

  for (final reading in ascending) {
    final index =
        reading.timestamp.difference(origin).inMilliseconds ~/ bucketMs;
    if (index != bucketIndex) {
      flush();
      bucketIndex = index;
      count = 0;
      sumValue = 0;
      sumTimeMs = 0;
    }
    count += 1;
    sumValue += reading.value;
    sumTimeMs += reading.timestamp.millisecondsSinceEpoch;
    last = reading;
  }
  flush();

  // The averaged last bucket would lag the real latest value: put the real one back.
  if (thinned.isNotEmpty) thinned[thinned.length - 1] = ascending.last;

  return thinned.length < 2 ? ascending : thinned;
}
