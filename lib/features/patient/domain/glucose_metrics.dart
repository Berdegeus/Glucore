/// Estimated HbA1c (GMI) for a mean glucose in mg/dL, in percent, to two
/// decimals: `3.31 + 0.02392 x mean`.
///
/// The same formula the backend's `glucose_metrics()` applies; both sides are
/// tested against `contracts/gmi-cases.json` (API-09), so the report in the app
/// and the web dashboard cannot drift apart.
double gmiFromMean(double mean) {
  final gmi = 3.31 + 0.02392 * mean;
  return (gmi * 100).round() / 100;
}
