# Decisões de arquitetura (ADRs)

Cada arquivo registra uma decisão do backend: o contexto, o que foi decidido, o que se ganhou e o que se
perdeu. O formato é o de Michael Nygard (Contexto · Decisão · Consequências). O estado de cada decisão é
`Aceita` quando está no código da `main`.

| # | Decisão | Onde está no código |
|---|---|---|
| [0001](0001-tres-servicos-e-gateway.md) | Três serviços atrás de um gateway único | `backend/services/*` |
| [0002](0002-banco-por-servico-e-fronteira-de-identidade.md) | Banco por serviço; a fronteira é identidade, não domínio clínico | `*/prisma/schema.prisma` |
| [0003](0003-papel-na-claim-do-jwt.md) | O papel viaja na claim do JWT, com TTL por papel | `packages/shared/src/auth/` |
| [0004](0004-camadas-repository-e-di-manual.md) | Módulos em camadas, Repository e injeção de dependência à mão | `*/src/modules/`, `*/src/container.ts` |
| [0005](0005-service-registry-strategy.md) | Service Discovery atrás de uma interface (Strategy) | `packages/shared/src/discovery/` |
| [0006](0006-saga-de-registro.md) | Registro de conta como saga com compensação | `gateway/src/modules/register/` |
| [0007](0007-token-interno-entre-servicos.md) | Chamadas serviço a serviço com token interno assinado | `packages/shared/src/auth/`, `*/src/modules/internal/` |
