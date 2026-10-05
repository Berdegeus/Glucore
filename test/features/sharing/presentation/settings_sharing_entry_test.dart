import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/theme_cubit.dart';
import 'package:glucore/features/patient/presentation/pages/settings_page.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/repositories/sharing_repository.dart';
import 'package:glucore/features/sharing/domain/usecases/generate_invite.dart';
import 'package:glucore/features/sharing/domain/usecases/list_grants.dart';
import 'package:glucore/features/sharing/domain/usecases/revoke_grant.dart';
import 'package:glucore/features/sharing/presentation/cubit/sharing_cubit.dart';
import 'package:glucore/features/sharing/presentation/pages/sharing_page.dart';
import 'package:glucore/injection_container.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _EmptySharingRepository implements SharingRepository {
  @override
  Future<InviteCode> generateInvite() => throw UnimplementedError();

  @override
  Future<List<Grant>> listGrants() async => [];

  @override
  Future<void> revokeGrant(String id) => throw UnimplementedError();
}

/// CON-01 — "WHEN o paciente toca 'Compartilhar com profissional' no app THEN
/// the system SHALL gerar um código…": o toque na entrada das configurações
/// chega à tela que gera o código.
void main() {
  late AppLocalizations l10n;
  late ThemeCubit themeCubit;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    themeCubit = ThemeCubit();
    await sl.reset();
    final repository = _EmptySharingRepository();
    sl.registerFactory(
      () => SharingCubit(
        generateInvite: GenerateInvite(repository),
        listGrants: ListGrants(repository),
        revokeGrant: RevokeGrant(repository),
      ),
    );
  });

  tearDown(() async {
    await themeCubit.close();
    await sl.reset();
  });

  testWidgets('tocar em "Compartilhar com profissional" abre a tela de '
      'compartilhamento', (tester) async {
    await tester.pumpWidget(
      BlocProvider<ThemeCubit>.value(
        value: themeCubit,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('pt', 'BR'),
          theme: AppTheme.light(),
          home: const SettingsPage(),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(SharingPage), findsNothing);

    // A entrada fica no fim da lista: rolar até ela é parte do gesto real.
    await tester.scrollUntilVisible(find.text(l10n.sharingTitle), 200);
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.sharingTitle));
    await tester.pumpAndSettle();

    expect(find.byType(SharingPage), findsOneWidget);
    expect(find.text(l10n.sharingExplanationTitle), findsOneWidget);
    expect(find.text(l10n.sharingGenerateButton), findsOneWidget);
  });
}
