import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/glucore_form_layout.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'carb_edit_page.dart';
import 'insulin_edit_page.dart';

class DiaryPage extends StatelessWidget {
  const DiaryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: UserAppBar(title: const Text('Diário')),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          final groups = _buildDayGroups(context, state);

          if (groups.isEmpty) {
            return const _EmptyDiary();
          }

          return LayoutBuilder(
            builder: (context, constraints) {
              return constraints.maxWidth <= GlucoreFormLayout.breakpoint
                  ? _SingleColumnDiary(groups: groups)
                  : _TwoColumnDiary(groups: groups);
            },
          );
        },
      ),
    );
  }

  /// Builds carb/insulin entries grouped by day, newest day first. Splitting
  /// into groups (rather than a flat header/item list) lets the wide layout
  /// hand whole days to a column without ever separating a header from its
  /// own entries.
  List<_DayGroup> _buildDayGroups(BuildContext context, PatientState state) {
    final items = <_DiaryItem>[];

    for (final c in state.carbs) {
      items.add(_DiaryItem(
        time: c.time,
        icon: Icons.restaurant_rounded,
        color: context.glucoreColors.zoneTargetBg,
        title: c.description.isEmpty ? 'Refeição' : c.description,
        detail: '${c.grams} g carb',
        onTap: () => Navigator.of(context).push(
          buildPatientScopedRoute(context, CarbEditPage(entry: c)),
        ),
      ));
    }
    for (final ins in state.insulin) {
      items.add(_DiaryItem(
        time: ins.time,
        icon: Icons.vaccines_outlined,
        color: context.glucoreColors.brandBlue,
        title: _insulinLabel(ins.type),
        detail: '${ins.units.toStringAsFixed(1)} UI · ${ins.dayOfWeek}',
        onTap: () => Navigator.of(context).push(
          buildPatientScopedRoute(context, InsulinEditPage(entry: ins)),
        ),
      ));
    }

    items.sort((a, b) => b.time.compareTo(a.time));

    final groups = <_DayGroup>[];
    String? lastDay;

    for (final item in items) {
      final dayKey = DateFormat('yyyy-MM-dd').format(item.time);
      if (dayKey != lastDay) {
        groups.add(_DayGroup(label: _dayLabel(item.time)));
        lastDay = dayKey;
      }
      groups.last.items.add(item);
    }

    return groups;
  }

  String _insulinLabel(InsulinType type) => switch (type) {
        InsulinType.bolus => 'Insulina bolus',
        InsulinType.basal => 'Insulina basal',
        InsulinType.correction => 'Correção',
      };

  String _dayLabel(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    if (d == today) return 'Hoje';
    if (d == today.subtract(const Duration(days: 1))) return 'Ontem';
    return DateFormat('EEEE, d MMM', 'pt_BR').format(dt);
  }
}

class _DayGroup {
  _DayGroup({required this.label});
  final String label;
  final List<_DiaryItem> items = <_DiaryItem>[];
}

/// Layout at or below [GlucoreFormLayout.breakpoint]: the pre-existing single
/// scrolling column, day header followed by that day's entries.
class _SingleColumnDiary extends StatelessWidget {
  const _SingleColumnDiary({required this.groups});
  final List<_DayGroup> groups;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [for (final group in groups) _DayGroupColumn(group: group)],
    );
  }
}

/// Layout above [GlucoreFormLayout.breakpoint]: whole day groups are dealt
/// alternately into two side-by-side columns so a day's header always stays
/// with its own entries.
class _TwoColumnDiary extends StatelessWidget {
  const _TwoColumnDiary({required this.groups});
  final List<_DayGroup> groups;

  @override
  Widget build(BuildContext context) {
    final left = <_DayGroup>[];
    final right = <_DayGroup>[];
    for (var i = 0; i < groups.length; i++) {
      (i.isEven ? left : right).add(groups[i]);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              children: [for (final group in left) _DayGroupColumn(group: group)],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              children: [for (final group in right) _DayGroupColumn(group: group)],
            ),
          ),
        ],
      ),
    );
  }
}

class _DayGroupColumn extends StatelessWidget {
  const _DayGroupColumn({required this.group});
  final _DayGroup group;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DayHeaderWidget(label: group.label),
        for (final item in group.items) _DiaryItemTile(item: item),
      ],
    );
  }
}

class _DiaryItem {
  const _DiaryItem({
    required this.time,
    required this.icon,
    required this.color,
    required this.title,
    required this.detail,
    this.onTap,
  });

  final DateTime time;
  final IconData icon;
  final Color color;
  final String title;
  final String detail;
  final VoidCallback? onTap;
}

class _DayHeaderWidget extends StatelessWidget {
  const _DayHeaderWidget({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: context.glucoreColors.inkMuted,
        ),
      ),
    );
  }
}

class _DiaryItemTile extends StatelessWidget {
  const _DiaryItemTile({required this.item});
  final _DiaryItem item;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: item.onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: context.glucoreColors.surfaceCanvas,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: item.color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(item.icon, color: item.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: context.glucoreColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.detail,
                    style: TextStyle(fontSize: 12, color: context.glucoreColors.inkMuted),
                  ),
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat.Hm().format(item.time),
                  style: TextStyle(fontSize: 12, color: context.glucoreColors.inkMuted),
                ),
                if (item.onTap != null) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 16, color: context.glucoreColors.inkMuted),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyDiary extends StatelessWidget {
  const _EmptyDiary();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.book_outlined, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(
            'Nenhuma observação ainda',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: context.glucoreColors.inkMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Use o botão + para registrar refeições e insulina',
            style: TextStyle(fontSize: 13, color: context.glucoreColors.inkMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
