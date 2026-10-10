import 'dart:async';

import 'package:flutter/widgets.dart';

/// Rebuilds [builder] every [interval].
///
/// For UI that depends on the clock rather than on state — "18 min atrás",
/// "is this reading still live" — and would otherwise stay frozen at whatever
/// it said at the last rebuild. A glucose reading that looks 18 minutes old
/// when it is really 30 is worse than no label at all.
class PeriodicRebuild extends StatefulWidget {
  const PeriodicRebuild({
    super.key,
    required this.builder,
    this.interval = const Duration(seconds: 30),
  });

  final WidgetBuilder builder;
  final Duration interval;

  @override
  State<PeriodicRebuild> createState() => _PeriodicRebuildState();
}

class _PeriodicRebuildState extends State<PeriodicRebuild> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(widget.interval, (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}
