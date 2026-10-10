import 'package:flutter/material.dart';

import '../../../../core/theme/glucore_colors.dart';

/// A compact, snapping selector for the chart's look-back window.
///
/// A pill track with a sliding thumb that only ever rests on an option. It can
/// be tapped or dragged along; while a finger is down the thumb presses in and
/// the track darkens, so the control answers the touch visibly.
class GlucoseWindowSelector extends StatefulWidget {
  const GlucoseWindowSelector({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  /// Window sizes in hours, in the order they are laid out.
  final List<int> options;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  State<GlucoseWindowSelector> createState() => _GlucoseWindowSelectorState();
}

class _GlucoseWindowSelectorState extends State<GlucoseWindowSelector> {
  static const double _height = 32;
  static const double _segmentWidth = 38;
  static const double _inset = 3;

  bool _pressed = false;

  int get _selectedIndex {
    final index = widget.options.indexOf(widget.selected);
    return index < 0 ? 0 : index;
  }

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  void _pickAt(double dx) {
    final count = widget.options.length;
    final index = (dx / _segmentWidth).floor().clamp(0, count - 1);
    final hours = widget.options[index];
    if (hours != widget.selected) widget.onChanged(hours);
  }

  void _step(int delta) {
    final next = (_selectedIndex + delta).clamp(0, widget.options.length - 1);
    final hours = widget.options[next];
    if (hours != widget.selected) widget.onChanged(hours);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.glucoreColors;
    final count = widget.options.length;
    final index = _selectedIndex;

    return Semantics(
      container: true,
      label: 'Janela do gráfico',
      value: '${widget.selected} horas',
      increasedValue: index < count - 1
          ? '${widget.options[index + 1]} horas'
          : null,
      decreasedValue: index > 0 ? '${widget.options[index - 1]} horas' : null,
      onIncrease: index < count - 1 ? () => _step(1) : null,
      onDecrease: index > 0 ? () => _step(-1) : null,
      // The press-in shows on the very first touch (a Listener sees it before
      // any gesture is decided); the choice itself is made on release or while
      // dragging, so scrolling the page from here never picks an option.
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: (_) => _setPressed(true),
        onPointerUp: (_) => _setPressed(false),
        onPointerCancel: (_) => _setPressed(false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (d) => _pickAt(d.localPosition.dx),
          onHorizontalDragStart: (d) => _pickAt(d.localPosition.dx),
          onHorizontalDragUpdate: (d) => _pickAt(d.localPosition.dx),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            width: _segmentWidth * count,
            height: _height,
            decoration: BoxDecoration(
              color: colors.inkMuted.withValues(alpha: _pressed ? 0.18 : 0.10),
              borderRadius: BorderRadius.circular(_height / 2),
            ),
            child: Stack(
              children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutBack,
                  left: index * _segmentWidth,
                  top: 0,
                  width: _segmentWidth,
                  height: _height,
                  child: Padding(
                    padding: const EdgeInsets.all(_inset),
                    child: AnimatedScale(
                      scale: _pressed ? 0.9 : 1,
                      duration: const Duration(milliseconds: 120),
                      curve: Curves.easeOut,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.brandBlue,
                          borderRadius: BorderRadius.circular(_height / 2),
                          boxShadow: [
                            BoxShadow(
                              color: colors.brandBlue.withValues(alpha: 0.35),
                              blurRadius: _pressed ? 3 : 8,
                              offset: Offset(0, _pressed ? 1 : 3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                // The announced value lives on the selector node; reading each
                // label too would only be noise.
                ExcludeSemantics(
                  child: Row(
                    children: [
                      for (var i = 0; i < count; i++)
                        SizedBox(
                          width: _segmentWidth,
                          height: _height,
                          child: Center(
                            child: AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 180),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: i == index
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: i == index
                                    ? Colors.white
                                    : colors.inkMuted,
                              ),
                              child: Text('${widget.options[i]}h'),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
