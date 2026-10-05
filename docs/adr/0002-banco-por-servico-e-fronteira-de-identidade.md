# 0002 — Banco por serviço; a fronteira é identidade, não domínio clínico

**Estado:** Aceita · **Data:** 2026-08-27 · **Issue:** #30

## Contexto
Dividir o código sem dividir o banco deixa os serviços acoplados pelo schema. Era preciso decidir
onde cortar o modelo de dados, que tinha 20 chaves estrangeiras.

## Decisão
Cada serviço tem o seu `schema.prisma`, o seu histórico de migrações e o seu client Prisma.

O corte fica em `User`, `AuthCredential`, `PasswordResetToken` e `AuthSession`, que vão para o
`auth-service`. Tudo que é clínico permanece junto no `glucose-service`. Das 20 chaves, 17 continuam
intactas, e a cadeia sensor → vínculo → paciente → leitura segue com integridade e `CASCADE` dentro de
`glucore_dev`. Só 3 são cortadas: `Patient.userId`, `HealthProfessional.userId` e
`Administrator.userId` viram `UUID` soltos. O que atravessa entre os serviços é o `userId` dentro do
JWT.

`HealthProfessional` fica do lado clínico de propósito, para que `DashboardAccessGrant` (paciente ↔
profissional ↔ relatório) seja uma relação interna a um serviço.

Cada serviço gera o client Prisma num diretório próprio (`auth-service/generated/prisma`). A saída
padrão em `node_modules/.prisma/client` é única no workspace e o último `prisma generate` venceria.

## Consequências
- **Perda:** o `ON DELETE CASCADE` de `Patient.userId → User.id`. O banco não impede mais paciente
  órfão. Por isso `DELETE /api/v1/account` virou obrigatório e é orquestrado pelo gateway (LGPD).
- **Armadilha conhecida:** no `auth-service`, importar `Prisma` de `@prisma/client` está errado.
  São classes diferentes, todo `instanceof` seria falso e todo erro `P2002` viraria 500. A importação
  correta é de `src/lib/prisma.ts`, o único arquivo que conhece o caminho gerado.
- **Migração destrutiva:** remover as tabelas de identidade do banco clínico foi a migração de maior
  risco. O SQL foi lido antes de aplicar, toda FK cai antes de qualquer `DROP TABLE`, e o resultado
  foi conferido contra o banco real (627 leituras e 5 pacientes idênticos antes e depois).
- `packages/shared` não depende de `@prisma/client`, para o gateway, que não tem banco, poder usar o
  mesmo tratamento de erros.
