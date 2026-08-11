# Conformidade com o Checklist TCC I — Design

**Spec**: `.specs/features/checklist-tcc-compliance/spec.md`

## Princípio orientador

Toda lacuna do checklist é resolvida criando **uma fonte única** e trocando os pontos de uso — nunca corrigindo tela por tela. Cada item vira um módulo compartilhado (validador, widget, helper, middleware) com os call sites migrados para ele. É isso que transforma "27 telas quase iguais" em evidência verificável para a banca.

## Arquitetura das mudanças

```
Flutter                                          Backend
──────────────────────────────────────────       ──────────────────────────────────────
core/validation/password_policy.dart      ◀────▶ src/lib/passwordPolicy.ts
  (regra única de força)                          (mesma regra, mesma mensagem)

core/utils/phone_input.dart                       src/lib/audit.ts
  (máscara + normalização)                          (recordAudit, best-effort)

core/api/api_client.dart                          src/middleware/prismaError.ts
  + onError → SessionExpiredNotifier                (P2002/P2003/P2025/P1001 → HTTP)

core/session/session_expiry_notifier.dart         src/middleware/auth.ts
  (sinal único, idempotente)                        + code:'TOKEN_INVALID'
                                                    + requireRole(...roles)
widgets/password_field.dart
widgets/glucore_messenger.dart                    prisma/schema.prisma
widgets/glucore_form_layout.dart                    + model AuditLog
widgets/user_app_bar.dart
  (nome + menu Sair, usado por todas as telas)
```

## Componentes novos

### Flutter

| Componente | Arquivo | Responsabilidade | Requisito |
| ---------- | ------- | ---------------- | --------- |
| `PasswordPolicy` | `lib/core/validation/password_policy.dart` | `validate(String) → PasswordPolicyError?` com as 5 regras; função pura, sem dependência de `BuildContext` | TCC-01 |
| `PasswordField` | `lib/features/auth/presentation/widgets/password_field.dart` | `TextFormField` com `obscureText` local + `IconButton` de visibilidade; recebe `validator`, `label`, `helperText` | TCC-02, TCC-03 |
| `GlucoreMessenger` | `lib/features/patient/presentation/widgets/glucore_messenger.dart` | `info/warning/error/success(context, message)`; único lugar do app que constrói `SnackBar` | TCC-06 |
| `BrazilianPhoneInputFormatter` + `formatPhone`/`digitsOnly` | `lib/core/utils/phone_input.dart` | Máscara progressiva `(00) 00000-0000`; espelha o padrão de `date_input.dart` | TCC-08 |
| `SessionExpiryNotifier` | `lib/core/session/session_expiry_notifier.dart` | `ChangeNotifier` singleton; `signal()` idempotente com flag `consumed`, `reset()` no login | TCC-12 |
| `UserAppBar` | `lib/features/patient/presentation/widgets/user_app_bar.dart` | `AppBar` com título, nome do usuário e `PopupMenuButton` → "Sair da conta"; lê o nome de `UserIdentityCubit` | TCC-04 |
| `UserIdentityCubit` | `lib/features/patient/presentation/cubit/user_identity_cubit.dart` | Carrega `AccountProfile` uma vez por sessão e expõe `fullName`; fallback `profileDefaultName` | TCC-04, TCC-11 |
| `GlucoreFormLayout` | `lib/features/patient/presentation/widgets/glucore_form_layout.dart` | `LayoutBuilder` → `ConstrainedBox(maxWidth: 560)` centralizado acima de 600 dp | TCC-15 |
| `ChangePasswordPage` | `lib/features/patient/presentation/pages/change_password_page.dart` | Tela dedicada de troca de senha (3 campos + submit) | TCC-10 |
| `fieldLabel()` | `lib/core/utils/field_label.dart` | `fieldLabel(l10n, base, required: bool)` → `"Peso (kg) *"` / `"Peso (kg) (opcional)"` | TCC-05 |

### Backend

| Componente | Arquivo | Responsabilidade | Requisito |
| ---------- | ------- | ---------------- | --------- |
| `assertStrongPassword` / `isStrongPassword` | `src/lib/passwordPolicy.ts` | Mesma regra do app; usada em register, reset-password e profile | TCC-01 |
| `prismaErrorHandler` | `src/middleware/prismaError.ts` | Middleware de erro que traduz `PrismaClientKnownRequestError` / `PrismaClientInitializationError` em status + `code` | TCC-09, TCC-17 |
| `requireRole` | `src/middleware/auth.ts` (adiciona) | Resolve `user.role` no banco e compara com a lista permitida; 403 `FORBIDDEN_ROLE` | TCC-12 |
| `recordAudit` | `src/lib/audit.ts` | Insere em `AuditLog`; nunca lança para o chamador | TCC-13 |
| `model AuditLog` | `prisma/schema.prisma` + migração SQL | Tabela da trilha | TCC-13 |

## Decisões de design

**AD-1 — Força de senha duplicada de propósito, não compartilhada.** A regra vive em dois arquivos (Dart e TS) porque não há build step compartilhado entre app e backend. O acoplamento é garantido por teste: os dois lados testam a mesma tabela de casos (`senha123`, `SENHA123!`, `Senha123`, `Senha 123!`, `Senha123!`), e a tabela está no design para que divergência apareça como teste vermelho.

**AD-2 — Código de erro no corpo da resposta.** Todo erro de autenticação/banco passa a responder `{ error, code }`. É o `code` — não o status — que o app usa para decidir. Isso resolve a colisão real entre "token inválido" (deve deslogar) e "senha atual incorreta" (não deve), ambos `401` hoje.

**AD-3 — `SessionExpiryNotifier` em vez de o interceptor chamar o cubit.** O `ApiClient` é registrado no GetIt antes dos cubits e não pode depender de `AuthCubit` sem criar ciclo de DI. O notifier é um `ChangeNotifier` sem dependências que o `App` escuta para chamar `AuthCubit.logout()` e mostrar o aviso. Flag `consumed` garante o logout único mesmo com N requisições falhando juntas (edge case do spec).

**AD-4 — Papel lido do banco, não do JWT.** `requireRole` faz um `findUnique` por requisição em vez de confiar num claim. Custo: uma query a mais nas rotas de dados. Ganho: rebaixar o papel de um usuário passa a valer imediatamente, sem esperar token expirar (o TTL é 30 d — item 5.2 ficou fora de escopo).

**AD-5 — Auditoria best-effort.** `recordAudit` engole a própria exceção. Um paciente nunca deve perder um registro de insulina porque a trilha falhou; e a migração pode não estar aplicada em toda máquina de desenvolvimento.

**AD-6 — `UserIdentityCubit` separado de `PatientCubit`.** `PatientCubit` já carrega leituras, alertas, carbos e insulina; adicionar identidade ali aumentaria o acoplamento de um cubit que o P19 acabou de estabilizar. Um cubit pequeno, criado ao lado dos outros em `app.dart` (acima do Navigator raiz, por P17), mantém o nome disponível a qualquer rota empilhada.

**AD-7 — Migração SQL escrita à mão.** `prisma migrate dev` exige banco acessível. A migração `add_audit_log` é escrita no formato do Prisma (`migrations/<timestamp>_add_audit_log/migration.sql`) e documentada; `prisma migrate deploy` aplica normalmente.

## Contratos de erro (backend → app)

| Situação | Status | `code` | Ação do app |
| -------- | ------ | ------ | ----------- |
| Token ausente/inválido/expirado | 401 | `TOKEN_INVALID` | Apaga token, sinaliza expiração, volta ao login |
| Senha atual incorreta (`PUT /auth/profile`) | 401 | `INVALID_CURRENT_PASSWORD` | Mantém sessão, erro na tela |
| Papel não autorizado | 403 | `FORBIDDEN_ROLE` | Erro na tela, mantém sessão |
| Senha fraca | 400 | `WEAK_PASSWORD` | Erro na tela |
| E-mail já cadastrado | 409 | `EMAIL_TAKEN` | Erro na tela |
| Constraint única violada (P2002) | 409 | `DUPLICATE_RECORD` | Erro na tela |
| FK inexistente (P2003) | 409 | `RELATED_RECORD_MISSING` | Erro na tela |
| Registro não encontrado (P2025) | 404 | `RECORD_NOT_FOUND` | Erro na tela |
| Banco indisponível (P1001/P1002/init) | 503 | `DATABASE_UNAVAILABLE` | "Serviço temporariamente indisponível…" |
| Não classificado | 500 | `INTERNAL` | Mensagem genérica de servidor |

## Tabela de casos da política de senha (fonte de verdade para os testes dos dois lados)

| Entrada | Válida? | Motivo |
| ------- | ------- | ------ |
| `Senha123!` | sim | atende às 5 regras |
| `Sen1!` | não | menos de 8 caracteres |
| `senha123!` | não | sem maiúscula |
| `SENHA123!` | não | sem minúscula |
| `SenhaSenha!` | não | sem dígito |
| `Senha1234` | não | sem caractere especial |
| `Senha 123!` | sim | espaço conta como não alfanumérico e não invalida |
| `` (vazia) | não | menos de 8 caracteres |

## Modelo de dados

```prisma
model AuditLog {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String?  @db.Uuid
  entity    String
  action    String
  entityId  String?
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([entity, createdAt])
}
```

`userId` é nulável e `onDelete: SetNull` para que a trilha sobreviva à exclusão da conta — uma trilha que desaparece com o autor não audita nada.

## Impacto em comportamentos existentes

| Comportamento | Risco | Mitigação |
| ------------- | ----- | --------- |
| P18 — sessão tolerante a offline | Interceptor de 401 pode deslogar quando não deveria | O interceptor só age em resposta HTTP com `code: TOKEN_INVALID`; erro de conexão (sem resposta) passa intacto. Teste de regressão `auth_cubit_offline_test.dart` continua no gate |
| P19 — isolamento por usuário | `UserIdentityCubit` cacheia nome | Cubit é criado/destruído junto com os demais no `app.dart`, seguindo o ciclo de login/logout |
| P17 — providers acima do Navigator | Nova `UserAppBar` lê cubit em rotas empilhadas | `UserIdentityCubit` é registrado no mesmo `MultiBlocProvider` de `app.dart` |
| Contas legadas com senha fraca | Login bloqueado | Regra de força só onde a senha é definida; login valida apenas "não vazio" |
| `POST` replace-all de coleções (§P2) | Auditoria pode inflar | Um registro de auditoria por requisição (ação `REPLACE`), não por item |
