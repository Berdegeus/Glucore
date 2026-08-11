# Project State

## Decisions

### AD-001 — Regra de senha forte duplicada em Dart e TypeScript, acoplada por teste
**Data**: 2026-08-10
**Contexto**: O checklist do TCC (item 2.3) exige senha forte validada no cliente **e** na API. Não existe build step compartilhado entre o app Flutter e o backend Node.
**Decisão**: Manter duas implementações (`lib/core/validation/password_policy.dart` e `backend/src/lib/passwordPolicy.ts`) com a mesma tabela de casos testada nos dois lados. A tabela vive em `design.md` da feature `checklist-tcc-compliance`.
**Consequência**: Divergência entre as camadas aparece como teste vermelho, não como bug silencioso em produção.

### AD-002 — Erros da API passam a carregar `code` no corpo
**Data**: 2026-08-10
**Contexto**: `401` hoje significa tanto "token inválido" (deve deslogar) quanto "senha atual incorreta" na troca de senha (não deve deslogar). Um interceptor que olhasse só o status causaria logout indevido.
**Decisão**: Toda resposta de erro de autenticação e de banco inclui `{ error, code }`. O app decide pelo `code`, nunca pelo status isolado.
**Consequência**: Contrato documentado em `docs/architecture/backend.md`; novos erros devem declarar um `code`.

### AD-003 — Papel do usuário lido do banco a cada requisição
**Data**: 2026-08-10
**Contexto**: O TTL do JWT é de 30 dias (item 5.2 ficou fora de escopo), então um claim de papel dentro do token ficaria obsoleto por até um mês.
**Decisão**: `requireRole` resolve `user.role` via Prisma em cada requisição protegida.
**Consequência**: Uma query extra nas rotas de dados; rebaixamento de papel vale imediatamente.

### AD-004 — Auditoria é best-effort
**Data**: 2026-08-10
**Contexto**: A trilha de auditoria (item 4.11) não pode custar a gravação de um registro clínico do paciente, e a migração pode não estar aplicada em toda máquina de desenvolvimento.
**Decisão**: `recordAudit` engole a própria exceção e apenas loga.
**Consequência**: A trilha pode ter lacunas em falha de banco; isso é aceito e documentado.

### AD-005 — Itens 3.2 (2FA), 4.4 (DER) e 5.2 (timeout de sessão) fora do escopo
**Data**: 2026-08-10
**Contexto**: Decisão do usuário ao aprovar o escopo da feature `checklist-tcc-compliance`.
**Decisão**: Não implementar 2FA/TOTP, DER por engenharia reversa nem expiração por inatividade nesta iteração.
**Consequência**: `AuthSession.expiresAt`/`isRevoked` permanecem sem leitura; o checklist registra esses três itens como fora de escopo, não como pendência esquecida.

---

## Handoff

**Feature ativa**: `checklist-tcc-compliance`
**Fase**: Tasks concluída (`validate_spec.py` e `validate_tasks.py` limpos) — aguardando aprovação para Execute.
**Branch**: `main`
**Próximo passo**: T1 — `lib/core/validation/password_policy.dart`.
**Escopo**: 32 tarefas, 6 fases. Itens do checklist em escopo: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 4.5, 4.6(obs), 4.8, 4.10, 4.11, 5.1.
