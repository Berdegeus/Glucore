# 0005 — Service Discovery atrás de uma interface (Strategy)

**Estado:** Aceita · **Data:** 2026-08-31 · **Issue:** #30

## Contexto
O gateway precisa saber o endereço dos outros serviços. Em desenvolvimento queremos Consul de
verdade (registro, health check, remoção quando o serviço cai). Em produção a VM tem 1 GB de RAM e
roda uma pilha única, onde o Consul custaria memória sem entregar nada.

## Decisão
Uma interface mínima, `ServiceRegistry.resolve(serviceName): Promise<string>`, com duas
implementações em `packages/shared/src/discovery/`:

- `EnvServiceRegistry`: URLs fixas lidas do ambiente (`SERVICE_DISCOVERY=env`, usada em produção).
- `ConsulServiceRegistry`: resolve pelo Consul, com health check e remoção do registro no `SIGTERM`
  (`SERVICE_DISCOVERY=consul`, usada no `docker-compose.yml` de desenvolvimento).

Quem chama só conhece a interface. Trocar a estratégia é configuração, sem mudar código.

## Consequências
- **Verificado rodando:** com `docker compose stop auth-service`, o Consul marca o serviço como
  `critical` em cerca de 10 segundos e o gateway responde `503 UPSTREAM_UNAVAILABLE`. Ao reiniciar,
  o serviço se registra sozinho e o login volta a responder `200`.
- **Limitação:** em produção não há Service Discovery dinâmico, só endereços fixos. A demonstração
  completa de discovery vale para o ambiente de desenvolvimento.
- Cobre o caminho para outros provedores (DNS nativo de uma nuvem, por exemplo) sem tocar no código de
  chamada.
