# 0006 — Registro de conta como saga com compensação

**Estado:** Aceita · **Data:** 2026-08-31 · **Issue:** #30

## Contexto
Criar uma conta agora escreve em dois bancos: a credencial no `auth-service` e o paciente no
`glucose-service`. Antes do corte isso era uma transação. Uma transação distribuída (2PC) não é
possível aqui, já que são dois clients Prisma em dois bancos distintos.

## Decisão
O gateway orquestra uma saga (`gateway/src/modules/register/register.saga.ts`): cria a conta no
`auth-service`, depois cria o paciente no `glucose-service`. Se a segunda etapa falhar, executa a
compensação, que apaga a conta recém-criada, e devolve o erro original.

| Falha | Resultado |
|---|---|
| Auth OK, glucose falha, compensação OK | Erro devolvido, nada persiste, o cliente pode repetir |
| A compensação também falha | Registrado como `saga.compensation_failed` no log. **Aceito, não fechado.** |
| O gateway cai antes de responder | O cliente repete e recebe `409 EMAIL_TAKEN` |
| E-mail já existente | `409` antes de qualquer escrita no glucose |

A saga foi testada contra fakes HTTP: a compensação roda uma vez numa falha do glucose e zero vezes
num 409.

## Consequências
- Há uma janela de inconsistência: uma conta pode existir sem paciente se a compensação falhar.
  Fechar de verdade pede um outbox transacional, que não foi construído nesta fase.
- A mesma lógica explica o `DELETE /api/v1/account`, que também atravessa os dois serviços porque o
  banco já não propaga `CASCADE` entre eles (ADR 0002).
