# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
o projeto segue versionamento semântico (ver [docs/guides/versioning-and-branches.md](docs/guides/versioning-and-branches.md)).

## [1.1.0] — 2026-07-30

Integração multi-sensor + correção dos 3 problemas críticos abertos no relatório
de arquitetura (P17, P18, P19). Pendente de teste regressivo em hardware real
antes do release em `main`.

### Added
- **Accu-Chek SmartGuide**: protocolo e BLE manager próprios, pareamento com PIN.
- **FreeStyle Libre 2**: ativação por NFC, instalador da biblioteca de algoritmos
  da Abbott (extraída de um APK LibreLink) e streaming por BLE.
- **Base BLE brand-agnostic** (`BrandBleManager`): fila de escrita GATT serializada;
  marca resolvida via `getLibreVersion`.
- **Persistência offline-first**: SQLite local como fonte primária + sincronização
  em background (debounce/retry, reagenda com a conectividade).
- **Pilha de sensor com escopo de app**: `SensorCore` + `CgmForegroundService`
  (sobrevive à morte da Activity).
- **Versionamento**: `dev` = branch de integração; `main` = releases com tag.

### Fixed
- **P17 — navegação multi-marca** (`3ab0025`): `SensorCubit`/`PatientCubit`
  providos acima do Navigator raiz (`MaterialApp.builder`); abrir a escolha de
  sensor por Configurações/Perfil não lança mais `ProviderNotFoundException`.
- **P18 — login offline** (`5004f9f`): abrir o app sem rede não desloga mais.
  `isLoggedIn()` distingue `authenticated`/`invalid`/`unreachable`; o token só é
  apagado em 401/403; sessão offline é revalidada quando a rede volta.
- **P19 — isolamento por usuário** (`75c416a`): dados locais amarrados ao dono
  (`meta.owner_user_id`, `sub` do JWT); trocar de conta faz wipe + encerra a
  sessão do sensor; o sync nunca faz push entre contas.

### Security
- Endurecimento do backend: `JWT_SECRET` obrigatório (fail-fast), CORS restringível
  por `CORS_ORIGIN`, validação de entrada nas rotas.

### Notes
- Somente `arm64-v8a` (restrição dos `.so` do fornecedor).
- 29 testes passando; `flutter analyze` limpo; `assembleDebug` OK.

## [1.0.0] — baseline

Conexão BLE Sibionics viva, protocolo EU completo, shell Flutter com Bloc/Cubit,
backend com auth JWT e CRUD de carboidrato/insulina, painel de debug com sensor mock.

[1.1.0]: https://github.com/Berdegeus/Glucore/pull/7
