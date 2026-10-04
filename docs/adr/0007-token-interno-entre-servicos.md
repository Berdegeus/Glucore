# 0007 — Chamadas serviço a serviço com token interno assinado

**Estado:** Aceita · **Data:** 2026-08-31 · **Issue:** #30

## Contexto
O gateway chama os serviços em rotas `/internal/*` (criar conta, criar paciente, apagar conta). Se
essas rotas confiassem num cabeçalho como `x-user-id`, qualquer cliente que alcançasse um serviço
poderia se passar por outro usuário, e o isolamento seria só aparência.

## Decisão
As chamadas internas levam um token assinado com `INTERNAL_JWT_SECRET`, segredo diferente do
`JWT_SECRET` dos usuários. Os serviços aplicam `requireInternalAuth` nas rotas `/internal/*`. A
identidade do usuário só vem do token verificado, nunca de um cabeçalho que o cliente escreva. Além
disso, só o gateway publica porta. Os outros serviços não ficam expostos (`auth-service` nunca deve
ser exposto diretamente, porque o limite de tentativas de login vive no gateway).

## Consequências
- **Verificado por `curl`:** um `x-user-id` forjado não passa.
- **Custo:** mais um segredo para configurar nos três serviços. Segredos diferentes entre os serviços
  fazem todo request autenticado responder 401, e o README do backend documenta isso.
- Um token interno comprometido dá acesso às rotas `/internal/*`. Mitigação atual: rede interna sem
  porta publicada e rotação manual do segredo.
