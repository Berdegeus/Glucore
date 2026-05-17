// GS1 DataMatrix raw → human-readable (01)value(11)value... converter.
//
// Raw format from scanner: fixed-length AIs are concatenated without separator;
// variable-length AIs are terminated by FNC1 (ASCII 29 = \x1D).
// Example raw: "010697283164180311250623\x1D10LT4F250671J\x1D21250671N869803EDU17"
// Target:      "(01)06972831641803(11)250623(10)LT4F250671J(21)250671N869803EDU17"

// Known AI → fixed value length. AIs not listed here are treated as variable-length.
const _fixedLengths = <String, int>{
  '00': 18,
  '01': 14,
  '02': 14,
  '11': 6,
  '12': 6,
  '13': 6,
  '14': 6,
  '15': 6,
  '16': 6,
  '17': 6,
  '18': 6,
  '19': 6,
  '20': 2,
};

/// Normalises any GS1 DataMatrix barcode string to `(AI)value` human-readable
/// format. Accepts:
/// - Already formatted `(01)...` strings (returned as-is)
/// - Raw GS1 with FNC1 separators (ASCII 29)
/// - Raw GS1 without separators (fixed-length AIs only)
///
/// Returns `null` if the string is empty or unrecognisable.
String? normalizeGs1Barcode(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return null;

  // Already human-readable
  if (s.startsWith('(')) return s;

  // Strip AIM symbol identifier prefixes (]d2, ]C1, ]e0, etc.)
  final stripped = s.replaceFirst(RegExp(r'^\][a-zA-Z]\d'), '');

  final result = StringBuffer();

  // Split on FNC1 (ASCII 29) to get segments; each segment ends at a
  // variable-length AI boundary (or at end of string).
  for (final segment in stripped.split('\x1d')) {
    if (segment.isEmpty) continue;
    int pos = 0;

    while (pos < segment.length) {
      if (pos + 2 > segment.length) break;
      final ai = segment.substring(pos, pos + 2);
      final fixedLen = _fixedLengths[ai];

      if (fixedLen != null) {
        // Fixed-length AI: consume exactly fixedLen chars
        final end = pos + 2 + fixedLen;
        if (end > segment.length) break; // malformed
        result.write('($ai)${segment.substring(pos + 2, end)}');
        pos = end;
      } else {
        // Variable-length AI: consume the rest of this segment
        result.write('($ai)${segment.substring(pos + 2)}');
        break;
      }
    }
  }

  return result.isEmpty ? null : result.toString();
}
