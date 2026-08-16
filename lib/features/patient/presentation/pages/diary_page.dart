import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../models/patient_models.dart';
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
          final entries = _buildEntries(context, state);

          if (entries.isEmpty) {
            return const _EmptyDiary();
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            itemCount: entries.length,
            itemBuilder: (context, i) {
              final entry = entries[i];
              if (entry is _DayHeader) {
                return _DayHeaderWidget(label: entry.label);
              }
              if (entry is _DiaryItem) {
                return _DiaryItemTile(item: entry);
              }
              return const SizedBox.shrink();
            },
          );
        },
      ),
    );
  }

  List<Object> _buildEntries(BuildContext context, PatientState state) {
    final items = <_DiaryItem>[];

    for (final c in state.carbs) {
      items.add(_DiaryItem(
        time: c.time,
        icon: Icons.restaurant_rounded,
        color: AppTheme.zoneTargetBg,
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
        color: AppTheme.brandBlue,
        title: _insulinLabel(ins.type),
        detail: '${ins.units.toStringAsFixed(1)} UI · ${ins.dayOfWeek}',
        onTap: () => Navigator.of(context).push(
          buildPatientScopedRoute(context, InsulinEditPage(entry: ins)),
        ),
      ));
    }

    items.sort((a, b) => b.time.compareTo(a.time));

    final result = <Object>[];
    String? lastDay;

    for (final item in items) {
      final dayKey = DateFormat('yyyy-MM-dd').format(item.time);
      if (dayKey != lastDay) {
        result.add(_DayHeader(label: _dayLabel(item.time)));
        lastDay = dayKey;
      }
      result.add(item);
    }

    return result;
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

class _DayHeader {
  const _DayHeader({required this.label});
  final String label;
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
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: AppTheme.inkMuted,
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
          color: AppTheme.surfaceCanvas,
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
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.detail,
                    style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
                  ),
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat.Hm().format(item.time),
                  style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
                ),
                if (item.onTap != null) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right, size: 16, color: AppTheme.inkMuted),
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
          const Text(
            'Nenhuma observação ainda',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppTheme.inkMuted,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Use o botão + para registrar refeições e insulina',
            style: TextStyle(fontSize: 13, color: AppTheme.inkMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
