# 0003 — O papel viaja na claim do JWT, com TTL por papel

**Estado:** Aceita · **Data:** 2026-08-27 · **Issue:** #30, #15

## Contexto
Antes do corte, a autorização lia o papel do banco a cada requisição. Depois do corte, o papel mora no
`auth-service` e as rotas de dado clínico estão em outro serviço, então cada requisição custaria uma
chamada de rede só para saber o papel. O sistema tem perfis com riscos diferentes: o paciente fica
logado por meses no celular, enquanto o profissional de saúde acessa dado de terceiros pela web.

## Decisão
O token carrega `{ sub, role }` e quem verifica a assinatura confia na claim. O middleware
`verifyJwt`/`requireRole` fica em `packages/shared/src/auth/` e é compartilhado pelos serviços. Os
três serviços usam o mesmo `JWT_SECRET`.

A validade depende do papel:

| Papel | TTL |
|---|---|
| `PATIENT` | 30 dias |
| `HEALTH_PROFESSIONAL` | 1 hora |
| `ADMINISTRATOR` | 1 hora |

Um token com `role` ausente ou desconhecido é rejeitado, nunca promovido ou rebaixado a `PATIENT`
por padrão.

## Consequências
- **Ganho:** autorizar não exige consulta a banco nem chamada entre serviços.
- **Custo:** o papel pode ficar defasado até o token expirar. Para os papéis privilegiados a janela é
  de no máximo 1 hora, e é por isso que o TTL é curto. A revogação por `AuthSession.isRevoked` está
  desenhada para o gateway checar, mas ainda não está ligada nas rotas.
- **Estado atual:** as rotas de dado clínico usam `requireRole('PATIENT')`. Nenhuma rota exige ainda
  `HEALTH_PROFESSIONAL`, e esse perfil é o trabalho pendente das rubricas #14 e #15.
- O segredo compartilhado entre os três serviços é um ponto único de comprometimento. Por isso as
  chamadas internas usam um segundo segredo (ADR 0007).
