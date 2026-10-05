import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/repositories/sharing_repository.dart';
import 'package:glucore/features/sharing/domain/sharing_failure.dart';
import 'package:glucore/features/sharing/domain/usecases/generate_invite.dart';
import 'package:glucore/features/sharing/domain/usecases/list_grants.dart';
import 'package:glucore/features/sharing/domain/usecases/revoke_grant.dart';
import 'package:glucore/features/sharing/presentation/cubit/sharing_cubit.dart';
import 'package:glucore/features/sharing/presentation/pages/sharing_page.dart';
import 'package:glucore/l10n/l10n.dart';

const _code = 'K7M2PQ9X';

/// Porta dublê. O código vence em [codeLifetime] contado do relógio do teste
/// (o mesmo que a página usa), para a contagem regressiva ser verificável.
class _FakeSharingRepository implements SharingRepository {
  _FakeSharingRepository(this.clock, {List<Grant>? grants})
      : grants = grants ?? [];

  final DateTime Function() clock;
  List<Grant> grants;
  Duration codeLifetime = const Duration(hours: 24);
  SharingFailure? generateFailure;
  SharingFailure? revokeFailure;
  final revoked = <String>[];

  @override
  Future<InviteCode> generateInvite() async {
    if (generateFailure != null) throw generateFailure!;
    return InviteCode(code: _code, expiresAt: clock().add(codeLifetime));
  }

  @override
  Future<List<Grant>> listGrants() async => List.of(grants);

  @override
  Future<void> revokeGrant(String id) async {
    if (revokeFailure != null) throw revokeFailure!;
    revoked.add(id);
  }
}

Grant _grant(String id, String? name) => Grant(
      id: id,
      professionalName: name,
      specialty: 'Endocrinologia',
      grantedAt: DateTime.utc(2026, 10, 1, 15),
    );

void main() {
  late AppLocalizations l10n;
  late _FakeSharingRepository repository;
  late SharingCubit cubit;

  setUp(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
  });

  Future<void> pumpPage(
    WidgetTester tester, {
    List<Grant>? grants,
  }) async {
    repository = _FakeSharingRepository(
      () => tester.binding.clock.now(),
      grants: grants,
    );
    cubit = SharingCubit(
      generateInvite: GenerateInvite(repository),
      listGrants: ListGrants(repository),
      revokeGrant: RevokeGrant(repository),
    );
    addTearDown(cubit.close);

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('pt', 'BR'),
        theme: AppTheme.light(),
        home: BlocProvider<SharingCubit>.value(
          value: cubit,
          child: SharingPage(now: () => tester.binding.clock.now()),
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> tapGenerate(WidgetTester tester) async {
    await tester.tap(find.text(l10n.sharingGenerateButton));
    await tester.pump();
  }

  Finder codeText() => find.text(_code);

  group('CON-12: explicação antes de gerar', () {
    testWidgets('mostra o que o profissional vê, acima do botão, sem código',
        (tester) async {
      await pumpPage(tester);

      for (final fragment in [
        'leituras de glicose',
        'métricas diárias',
        'gráficos',
        'insulina',
        'carboidratos',
        'alertas',
        'código de uso único',
        '24 horas',
        'revogar o acesso a qualquer momento',
      ]) {
        expect(find.textContaining(fragment), findsOneWidget, reason: fragment);
      }
      expect(
        tester.getTopLeft(find.text(l10n.sharingExplanationTitle)).dy,
        lessThan(tester.getTopLeft(find.text(l10n.sharingGenerateButton)).dy),
      );
      expect(codeText(), findsNothing);
    });
  });

  group('CON-01: código com contagem regressiva', () {
    testWidgets('gerar mostra o código selecionável e a validade de 24 h',
        (tester) async {
      await pumpPage(tester);

      await tapGenerate(tester);

      expect(
        find.descendant(
          of: find.byType(SelectableText),
          matching: find.text(_code),
        ),
        findsOneWidget,
      );
      expect(find.text(l10n.sharingExpiresIn('24:00:00')), findsOneWidget);
    });

    testWidgets('a contagem regressiva diminui a cada segundo', (tester) async {
      await pumpPage(tester);
      await tapGenerate(tester);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.sharingExpiresIn('23:59:59')), findsOneWidget);

      await tester.pump(const Duration(seconds: 3));
      expect(find.text(l10n.sharingExpiresIn('23:59:56')), findsOneWidget);
    });

    testWidgets('no zero o código dá lugar ao texto de expirado',
        (tester) async {
      await pumpPage(tester);
      repository.codeLifetime = const Duration(seconds: 2);
      await tapGenerate(tester);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.sharingExpiresIn('00:00:01')), findsOneWidget);
      expect(codeText(), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text(l10n.sharingCodeExpired), findsOneWidget);
      expect(codeText(), findsNothing);
    });

    testWidgets('copiar põe o código na área de transferência', (tester) async {
      String? clipboard;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            clipboard = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await pumpPage(tester);
      await tapGenerate(tester);

      await tester.tap(find.text(l10n.sharingCopyButton));
      await tester.pump();

      expect(clipboard, _code);
      expect(find.text(l10n.sharingCodeCopied), findsOneWidget);
    });
  });

  group('CON-13: sem rede', () {
    testWidgets('mostra a mensagem exata e nenhum código', (tester) async {
      await pumpPage(tester);
      repository.generateFailure =
          const SharingFailure(SharingFailureKind.offline);

      await tapGenerate(tester);

      expect(
        find.text('Sem conexão. Conecte-se para gerar o código.'),
        findsOneWidget,
      );
      expect(codeText(), findsNothing);
      expect(find.byType(SelectableText), findsNothing);
      expect(find.textContaining('Expira em'), findsNothing);
    });
  });

  group('CON-08: vínculos', () {
    testWidgets('lista nome, especialidade e data; nome nulo usa o texto padrão',
        (tester) async {
      await pumpPage(
        tester,
        grants: [_grant('g1', 'Dra. Ana Souza'), _grant('g2', null)],
      );

      expect(find.text('Dra. Ana Souza'), findsOneWidget);
      expect(find.text(l10n.sharingUnknownProfessional), findsOneWidget);
      expect(
        find.text('Endocrinologia · ${l10n.sharingGrantedOn('01/10/2026')}'),
        findsNWidgets(2),
      );
    });

    testWidgets('sem vínculos mostra o estado vazio', (tester) async {
      await pumpPage(tester);

      expect(find.text(l10n.sharingGrantsEmpty), findsOneWidget);
    });

    testWidgets('revogar pede confirmação antes de chamar o servidor',
        (tester) async {
      await pumpPage(tester, grants: [_grant('g1', 'Dra. Ana Souza')]);

      await tester.tap(find.text(l10n.sharingRevokeButton));
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text(l10n.sharingRevokeConfirmTitle), findsOneWidget);
      expect(
        find.text(l10n.sharingRevokeConfirmBody('Dra. Ana Souza')),
        findsOneWidget,
      );
      expect(repository.revoked, isEmpty);

      await tester.tap(find.text(l10n.sharingRevokeCancelButton));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repository.revoked, isEmpty);
      expect(find.text('Dra. Ana Souza'), findsOneWidget);
    });

    testWidgets('confirmar revoga e tira o vínculo da lista', (tester) async {
      await pumpPage(
        tester,
        grants: [_grant('g1', 'Dra. Ana Souza'), _grant('g2', 'Dr. Bruno Lima')],
      );

      await tester.tap(find.text(l10n.sharingRevokeButton).first);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(l10n.sharingRevokeConfirmButton),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(repository.revoked, ['g1']);
      expect(find.text('Dra. Ana Souza'), findsNothing);
      expect(find.text('Dr. Bruno Lima'), findsOneWidget);
      expect(find.text(l10n.sharingRevoked), findsOneWidget);
    });

    testWidgets('falha ao revogar mantém o vínculo e avisa o motivo',
        (tester) async {
      await pumpPage(tester, grants: [_grant('g1', 'Dra. Ana Souza')]);
      repository.revokeFailure =
          const SharingFailure(SharingFailureKind.offline);

      await tester.tap(find.text(l10n.sharingRevokeButton));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(l10n.sharingRevokeConfirmButton),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('Dra. Ana Souza'), findsOneWidget);
      expect(find.text(l10n.sharingErrorOffline), findsOneWidget);
      expect(find.text(l10n.sharingRevoked), findsNothing);
    });
  });
}
