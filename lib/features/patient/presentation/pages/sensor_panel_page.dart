import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../cubit/patient_cubit.dart';
import '../widgets/user_app_bar.dart';
import 'libre_nfc_page.dart';

/// Colour that sums up the link with the sensor: green while data flows, amber
/// while it is (re)connecting or syncing, red when there is no link.
Color sensorStatusColor(BuildContext context, SensorConnectionStatus status) {
  final colors = context.glucoreColors;
  return switch (status) {
    SensorConnectionStatus.connected ||
    SensorConnectionStatus.readingAvailable =>
      colors.zoneTargetBg,
    SensorConnectionStatus.scanning ||
    SensorConnectionStatus.connecting ||
    SensorConnectionStatus.pairing ||
    SensorConnectionStatus.syncingHistory ||
    SensorConnectionStatus.warmingUp =>
      colors.brandAmber,
    SensorConnectionStatus.idle ||
    SensorConnectionStatus.disconnected ||
    SensorConnectionStatus.error =>
      colors.zoneLowBg,
  };
}

bool sensorCanConnect(SensorConnectionStatus status) =>
    status == SensorConnectionStatus.idle ||
    status == SensorConnectionStatus.disconnected ||
    status == SensorConnectionStatus.error;

String _brandName(SensorBrand brand) => switch (brand) {
      SensorBrand.sibionics => 'Sibionics',
      SensorBrand.accuchek => 'Accu-Chek SmartGuide',
      SensorBrand.libre2 => 'FreeStyle Libre 2',
    };

/// Control panel of the linked sensor: connection, serial, remaining life and
/// the latest readings, with the actions to reconnect or swap the sensor.
class SensorPanelPage extends StatelessWidget {
  const SensorPanelPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.sensorPanelTitle)),
      body: BlocBuilder<SensorCubit, SensorUiState>(
        builder: (context, state) {
          final session = state.session;
          if (session == null) return const SizedBox.shrink();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _ConnectionCard(state: state),
              const SizedBox(height: 12),
              _ConnectionActions(state: state),
              const SizedBox(height: 16),
              _InfoCard(session: session),
              const SizedBox(height: 12),
              _LifeCard(life: state.sensorLife),
              const SizedBox(height: 12),
              const _RecentReadingsCard(),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => _confirmReplace(context),
                icon: const Icon(Icons.swap_horiz_rounded),
                label: Text(l10n.sensorPanelReplaceButton),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmReplace(BuildContext context) async {
    final l10n = context.l10n;
    final cubit = context.read<SensorCubit>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.sensorPanelReplaceConfirmTitle),
        content: Text(l10n.sensorPanelReplaceConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.genericCancelButton),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.sensorPanelReplaceButton),
          ),
        ],
      ),
    );
    if (confirmed == true) await cubit.clearSession();
  }
}

class _PanelCard extends StatelessWidget {
  const _PanelCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.glucoreColors.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: context.glucoreColors.inkMuted,
        ),
      );
}

class _ConnectionCard extends StatelessWidget {
  const _ConnectionCard({required this.state});
  final SensorUiState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final color = sensorStatusColor(context, state.status);
    final reading = state.reading;

    final String subtitle;
    if (state.status == SensorConnectionStatus.error && state.failure != null) {
      subtitle = state.failure!.message;
    } else if (state.status == SensorConnectionStatus.syncingHistory) {
      subtitle = l10n.sensorLinkSyncingHistorySubtitle(
        state.historySyncInfo?.receivedCount ?? 0,
      );
    } else if (reading != null) {
      subtitle = l10n.genericUpdatedAtLabel(
        context.formatShortDateTime(reading.timestamp),
      );
    } else {
      subtitle = _brandName(state.brand);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state.status.label(l10n),
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: context.glucoreColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 13,
                    color: context.glucoreColors.inkMuted,
                  ),
                ),
              ],
            ),
          ),
          if (reading != null)
            Text(
              reading.value.toStringAsFixed(0),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: context.glucoreColors.ink,
              ),
            ),
        ],
      ),
    );
  }
}

class _ConnectionActions extends StatelessWidget {
  const _ConnectionActions({required this.state});
  final SensorUiState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<SensorCubit>();
    final canConnect = sensorCanConnect(state.status);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (canConnect)
          FilledButton.icon(
            onPressed: cubit.startMonitoring,
            icon: const Icon(Icons.bluetooth_searching),
            label: Text(l10n.glucoseReconnectButton),
          )
        else
          OutlinedButton.icon(
            onPressed: cubit.stopMonitoring,
            icon: const Icon(Icons.bluetooth_disabled),
            label: Text(l10n.genericDisconnectButton),
          ),
        if (state.brand == SensorBrand.libre2) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const LibreNFCPage()),
            ),
            icon: const Icon(Icons.nfc_rounded),
            label: Text(l10n.sensorPanelRescanNfcButton),
          ),
        ],
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.session});
  final SensorSession session;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return _PanelCard(
      child: Column(
        children: [
          _InfoRow(l10n.sensorPanelBrandLabel, _brandName(session.brand)),
          const SizedBox(height: 10),
          _InfoRow(
            l10n.sensorPanelSerialLabel,
            session.sensorId,
            mono: true,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value, {this.mono = false});
  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final colors = context.glucoreColors;
    final valueStyle = mono
        ? GoogleFonts.jetBrainsMono(fontSize: 13, color: colors.ink)
        : TextStyle(fontSize: 14, color: colors.ink);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(value, textAlign: TextAlign.end, style: valueStyle),
        ),
      ],
    );
  }
}

class _LifeCard extends StatelessWidget {
  const _LifeCard({required this.life});
  final SensorLife? life;

  static String _remaining(Duration left) {
    if (left < const Duration(days: 1)) {
      return '${left.inHours < 1 ? 1 : left.inHours}h';
    }
    final hours = left.inHours - left.inDays * 24;
    return hours == 0 ? '${left.inDays}d' : '${left.inDays}d ${hours}h';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;
    final life = this.life;
    final now = DateTime.now();

    Widget body;
    if (life == null) {
      body = Text(
        l10n.sensorPanelLifeUnknown,
        style: TextStyle(fontSize: 13, color: colors.inkMuted),
      );
    } else {
      final total = life.expectedEnd.difference(life.startedAt).inSeconds;
      final used = now.difference(life.startedAt).inSeconds;
      final progress = total <= 0 ? 1.0 : (used / total).clamp(0.0, 1.0);
      final ended = life.hasEnded(now);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ended
                ? l10n.sensorPanelLifeEnded
                : l10n.sensorPanelLifeRemaining(_remaining(life.remaining(now))),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: ended ? colors.zoneLowBg : colors.ink,
            ),
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: progress, minHeight: 6),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                l10n.sensorPanelStartedAt(
                  context.formatShortDateTime(life.startedAt),
                ),
                style: TextStyle(fontSize: 12, color: colors.inkMuted),
              ),
              Text(
                l10n.sensorPanelEndsAt(
                  context.formatShortDateTime(life.expectedEnd),
                ),
                style: TextStyle(fontSize: 12, color: colors.inkMuted),
              ),
            ],
          ),
        ],
      );
    }

    return _PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle(l10n.sensorPanelLifeTitle),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }
}

class _RecentReadingsCard extends StatelessWidget {
  const _RecentReadingsCard();

  static const _maxRows = 8;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;
    final state = context.watch<PatientCubit>().state;
    // `readings` is newest first.
    final recent = state.readings.take(_maxRows).toList();

    return _PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle(l10n.sensorPanelRecentReadingsTitle),
          const SizedBox(height: 8),
          if (recent.isEmpty)
            Text(
              l10n.sensorPanelNoReadings,
              style: TextStyle(fontSize: 13, color: colors.inkMuted),
            )
          else
            for (final r in recent)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    Text(
                      context.formatShortDateTime(r.timestamp),
                      style: TextStyle(fontSize: 13, color: colors.inkMuted),
                    ),
                    const Spacer(),
                    Text(
                      '${r.value.toStringAsFixed(0)} mg/dL',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.ink,
                      ),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}
