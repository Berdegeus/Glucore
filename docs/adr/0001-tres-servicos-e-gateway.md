# 0001 — Três serviços atrás de um gateway único

**Estado:** Aceita · **Data:** 2026-08-31 · **Issue:** #30

## Contexto
O backend nasceu como um único Express com um único banco. Dois fatores pediram a divisão: o app
Flutter vai dividir o backend com uma página web para o profissional de saúde (rubrica #14/#15), e
identidade (login, senha, sessão) muda por motivos e em ritmo diferentes do dado clínico (leituras,
carboidratos, insulina). A rubrica de microsserviços também pede serviços isolados que não
compartilham banco.

## Decisão
Três serviços num monorepo npm workspaces:

| Serviço | Porta | Banco | Papel |
|---|---|---|---|
| `gateway` | 3000 | — | Única entrada pública, tudo sob `/api/v1`. Valida o JWT, faz proxy, compõe `/me`, `DELETE /account` e o registro, e aplica os rate limiters. |
| `auth-service` | 3002 | `glucore_auth_dev` | Identidade: `User`, `AuthCredential`, `PasswordResetToken`, `AuthSession`. |
| `glucose-service` | 3001 | `glucore_dev` | Dado clínico: pacientes, sensores, leituras, carboidratos, insulina, alertas, dashboard. |

O app Flutter só conhece o gateway. Os serviços internos não publicam porta em produção.

A ordem foi deliberada: primeiro a rede de segurança de testes e as camadas dentro do
`glucose-service` (ADR 0004), depois o corte de rede. Refatorar camadas através de uma fronteira HTTP
custa bem mais, e um estouro de prazo ainda deixaria um sistema em camadas defensável.

## Consequências
- **Ganho:** deploy e escala independentes, o login rate-limited fica fora do alcance direto e a
  identidade pode evoluir sem tocar no dado clínico.
- **Custo:** operações que antes eram uma transação passam a atravessar a rede (ver ADR 0006) e o
  desenvolvimento local exige três processos (`docker compose up --build` resolve).
- **Limitação assumida:** em produção os três serviços rodam numa só VM e o Postgres é uma instância
  com dois bancos. Isso é banco por serviço na forma, mas compartilha o domínio de falha.
- **Fora do que foi feito:** não há fluxo assíncrono entre os serviços (sem fila ou mensageria). Todas
  as chamadas entre eles são síncronas.
