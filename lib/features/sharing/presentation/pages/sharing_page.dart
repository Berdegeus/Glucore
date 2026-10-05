import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../patient/presentation/widgets/glucore_messenger.dart';
import '../../../patient/presentation/widgets/user_app_bar.dart';
import '../../domain/entities/grant.dart';
import '../../domain/entities/invite_code.dart';
import '../cubit/sharing_cubit.dart';
import '../cubit/sharing_state.dart';

/// Compartilhamento com profissionais de saúde: explica o que o profissional
/// passa a ver (CON-12), gera o código de uso único com contagem regressiva
/// (CON-01) e lista os vínculos com a opção de revogar (CON-08).
///
/// Espera um [SharingCubit] acima na árvore.
class SharingPage extends StatefulWidget {
  /// [now] é o relógio da contagem regressiva; os testes injetam o deles.
  const SharingPage({super.key, this.now});

  final DateTime Function()? now;

  @override
  State<SharingPage> createState() => _SharingPageState();
}

class _SharingPageState extends State<SharingPage> {
  @override
  void initState() {
    super.initState();
    context.read<SharingCubit>().loadGrants();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      backgroundColor: context.glucoreColors.surfaceElevated,
      appBar: UserAppBar(title: Text(l10n.sharingTitle)),
      body: BlocConsumer<SharingCubit, SharingState>(
        // Só falhas de gerar/listar (que passam por `loading`); a de revogar
        // é avisada por `_revoke`, que sabe o resultado da própria chamada.
        listenWhen: (previous, current) =>
            previous.status == SharingStatus.loading &&
            current.status == SharingStatus.error,
        listener: (context, state) =>
            GlucoreMessenger.error(context, _errorText(l10n, state.error)),
        builder: (context, state) {
          final invite = state.invite;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
            children: [
              const _ExplanationCard(),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: state.status == SharingStatus.loading
                    ? null
                    : () => context.read<SharingCubit>().generateInvite(),
                child: Text(l10n.sharingGenerateButton),
              ),
              if (state.status == SharingStatus.offline) ...[
                const SizedBox(height: 16),
                const _OfflineNotice(),
              ],
              if (invite != null) ...[
                const SizedBox(height: 16),
                _InviteCard(
                  key: ValueKey(invite),
                  invite: invite,
                  now: widget.now ?? DateTime.now,
                ),
              ],
              const SizedBox(height: 24),
              _GrantsSection(
                grants: state.grants,
                loading: state.status == SharingStatus.loading,
                onRevoke: (grant) => _revoke(context, grant),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _revoke(BuildContext context, Grant grant) async {
    final l10n = context.l10n;
    final cubit = context.read<SharingCubit>();
    final name = grant.professionalName ?? l10n.sharingUnknownProfessional;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.sharingRevokeConfirmTitle),
        content: Text(l10n.sharingRevokeConfirmBody(name)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.sharingRevokeCancelButton),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: dialogContext.glucoreColors.zoneLowBg,
            ),
            child: Text(l10n.sharingRevokeConfirmButton),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await cubit.revoke(grant.id);
    if (!context.mounted) return;
    if (cubit.state.status == SharingStatus.error) {
      GlucoreMessenger.error(context, _errorText(l10n, cubit.state.error));
    } else {
      GlucoreMessenger.success(context, l10n.sharingRevoked);
    }
  }
}

String _errorText(AppLocalizations l10n, SharingError? error) =>
    switch (error) {
      SharingError.offline => l10n.sharingErrorOffline,
      SharingError.forbidden => l10n.sharingErrorForbidden,
      SharingError.notFound => l10n.sharingErrorNotFound,
      SharingError.unknown || null => l10n.sharingErrorUnknown,
    };

BoxDecoration _cardDecoration(BuildContext context) => BoxDecoration(
      color: context.glucoreColors.surfaceCanvas,
      borderRadius: BorderRadius.circular(16),
    );

/// O que o profissional passa a ver, mostrado antes do botão (CON-12).
class _ExplanationCard extends StatelessWidget {
  const _ExplanationCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;

    Widget paragraph(IconData icon, String text) => Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: colors.brandBlue),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(fontSize: 14, color: colors.ink),
                ),
              ),
            ],
          ),
        );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.sharingExplanationTitle,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: colors.ink,
            ),
          ),
          paragraph(Icons.visibility_outlined, l10n.sharingExplanationData),
          paragraph(Icons.pin_outlined, l10n.sharingExplanationCode),
          paragraph(Icons.block_outlined, l10n.sharingExplanationRevoke),
        ],
      ),
    );
  }
}

/// Aviso de que gerar o código exige rede (CON-13). Nunca aparece com código.
class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice();

  @override
  Widget build(BuildContext context) {
    final colors = context.glucoreColors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.zoneHighSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.wifi_off_rounded, size: 18, color: colors.zoneHighInk),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              context.l10n.sharingOfflineMessage,
              style: TextStyle(fontSize: 14, color: colors.zoneHighInk),
            ),
          ),
        ],
      ),
    );
  }
}

/// O código gerado, com cópia e contagem regressiva até a validade (CON-01).
///
/// A contagem relê o relógio a cada segundo em vez de subtrair 1 s por tique:
/// o `Timer` pausa com o app em segundo plano, e o relógio de parede não.
class _InviteCard extends StatefulWidget {
  const _InviteCard({super.key, required this.invite, required this.now});

  final InviteCode invite;
  final DateTime Function() now;

  @override
  State<_InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends State<_InviteCard> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = _computeRemaining();
    if (_remaining > Duration.zero) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration _computeRemaining() {
    final left = widget.invite.expiresAt.difference(widget.now());
    return left.isNegative ? Duration.zero : left;
  }

  void _tick() {
    setState(() => _remaining = _computeRemaining());
    if (_remaining == Duration.zero) _timer?.cancel();
  }

  /// `HH:MM:SS`, arredondando para cima: só mostra `00:00:00` ao expirar.
  String _format(Duration duration) {
    final seconds = (duration.inMilliseconds + 999) ~/ 1000;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(seconds ~/ 3600)}:${two(seconds % 3600 ~/ 60)}:${two(seconds % 60)}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;
    final expired = _remaining == Duration.zero;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(context),
      child: expired
          ? Text(
              l10n.sharingCodeExpired,
              style: TextStyle(fontSize: 14, color: colors.zoneLowInk),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.sharingCodeLabel,
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
                const SizedBox(height: 8),
                SelectableText(
                  widget.invite.code,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 4,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: colors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.sharingExpiresIn(_format(_remaining)),
                  style: TextStyle(fontSize: 14, color: colors.inkMuted),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _copy,
                  icon: const Icon(Icons.copy_outlined, size: 18),
                  label: Text(l10n.sharingCopyButton),
                ),
              ],
            ),
    );
  }

  Future<void> _copy() async {
    final l10n = context.l10n;
    await Clipboard.setData(ClipboardData(text: widget.invite.code));
    if (!mounted) return;
    GlucoreMessenger.success(context, l10n.sharingCodeCopied);
  }
}

class _GrantsSection extends StatelessWidget {
  const _GrantsSection({
    required this.grants,
    required this.loading,
    required this.onRevoke,
  });

  final List<Grant> grants;
  final bool loading;
  final ValueChanged<Grant> onRevoke;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;
    final dateFormat = DateFormat.yMd(
      Localizations.localeOf(context).toString(),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            l10n.sharingGrantsTitle.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: colors.inkMuted,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Container(
          decoration: _cardDecoration(context),
          child: grants.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    loading ? '' : l10n.sharingGrantsEmpty,
                    style: TextStyle(fontSize: 14, color: colors.inkMuted),
                  ),
                )
              : Column(
                  children: [
                    for (var i = 0; i < grants.length; i++) ...[
                      if (i > 0)
                        const Divider(height: 1, indent: 16, endIndent: 16),
                      _GrantTile(
                        grant: grants[i],
                        grantedOn: l10n.sharingGrantedOn(
                          dateFormat.format(grants[i].grantedAt.toLocal()),
                        ),
                        onRevoke: () => onRevoke(grants[i]),
                      ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _GrantTile extends StatelessWidget {
  const _GrantTile({
    required this.grant,
    required this.grantedOn,
    required this.onRevoke,
  });

  final Grant grant;
  final String grantedOn;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  grant.professionalName ?? l10n.sharingUnknownProfessional,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colors.ink,
                  ),
                ),
                Text(
                  '${grant.specialty} · $grantedOn',
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onRevoke,
            style: TextButton.styleFrom(foregroundColor: colors.zoneLowBg),
            child: Text(l10n.sharingRevokeButton),
          ),
        ],
      ),
    );
  }
}
