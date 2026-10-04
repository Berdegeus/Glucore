# 0004 — Módulos em camadas, Repository e injeção de dependência à mão

**Estado:** Aceita · **Data:** 2026-08-27 · **Issue:** #24, #30

## Contexto
O backend original tinha a regra de negócio dentro dos handlers de rota, junto do acesso ao Prisma.
Isso impedia testar a regra sem banco e tornava qualquer troca de infraestrutura um refactor
espalhado. Era também pré-requisito do corte em serviços (ADR 0001).

## Decisão
Cada área de domínio é um módulo em `src/modules/<nome>/` com camadas de responsabilidade única:

| Arquivo | Responsabilidade |
|---|---|
| `*.routes.ts` | Declara o Router, sem lógica |
| `*.controller.ts` | Só `req`/`res` |
| `*.service.ts` | Regra de negócio, lança `AppError`, não importa Express nem Prisma |
| `*.repository.ts` | Interface `I<Nome>Repository` e a implementação `Prisma<Nome>Repository` |
| `*.schema.ts` | Validação e tipos de entrada |
| `*.mapper.ts` | Converte entre linha do banco e DTO (Adapter) |

O service depende da interface do repositório, não da implementação (Dependency Inversion). As
dependências entram por construtor, montadas à mão em `src/container.ts` de cada serviço, que é o
único lugar que sabe qual implementação satisfaz qual interface (Composition Root). `buildApp()`
monta o Express sem chamar `listen` e aceita um container opcional, o que permite supertest e
repositórios em memória nos testes.

Escolheu-se montar à mão em vez de usar um container de DI. Nesse tamanho o wiring são poucas
linhas por módulo e continua totalmente tipado, enquanto uma biblioteca com decorators exigiria um
passo de build de metadados e esconderia o grafo de dependências que o refactor existe para tornar
visível.

As Strategies do `auth-service` também são escolhidas no container: `BcryptPasswordHasher` (o custo é
argumento de construtor, não uma pergunta sobre `NODE_ENV`) e o `Mailer` (`SmtpMailer` ou
`ConsoleMailer`, decidido por configuração e não por `catch`).

## Consequências
- **Ganho:** a regra de negócio é testável com repositórios falsos, a infraestrutura é trocável e o
  grafo de dependências está num arquivo só. A suíte tem mais de 300 testes, com cobertura medida em
  cerca de 96% das instruções.
- **Custo:** cada módulo tem seis arquivos, e para um CRUD simples isso é mais cerimônia do que o
  necessário.
- **Limitação conhecida:** as interfaces de repositório ainda devolvem tipos do Prisma (por exemplo
  `Promise<CarbEvent[]>`). O service não importa o Prisma, mas enxerga o formato das linhas. Um
  desacoplamento completo devolveria tipos de domínio e moveria o mapper para dentro do repositório.
  Não foi feito por custo: são seis módulos e o ganho prático hoje é pequeno.
