# Deploy em produção

> Quando usar: para saber onde o backend roda hoje, como uma mudança chega lá, como operar a VM, como publicar a web na Vercel e o que ainda falta. O passo a passo de montar a VM do zero está em [`backend/deploy/README.md`](../../backend/deploy/README.md); este guia é o estado e a operação.

## Estado em 2026-10-04

O backend (gateway + auth-service + glucose-service + Postgres) roda em **uma VM Oracle Cloud Always Free**, atrás de Caddy com HTTPS automático.

| Item | Valor |
|---|---|
| URL pública | `https://glucore.duckdns.org` (o app usa `--dart-define=API_URL=https://glucore.duckdns.org`, só o host, sem `/api/v1`) |
| Região / shape | `sa-saopaulo-1`, `VM.Standard.E2.1.Micro` (AMD **x86_64**, 1/8 OCPU, 1 GB de RAM, 50 GB de disco, 4 GB de swap) |
| Custo | US$ 0/mês (Always Free) |
| Portas abertas | 80 e 443 para todos; 22 só para o IP do desenvolvedor (Security List) |
| Processos | Docker Compose: `postgres`, `auth-service`, `glucose-service`, `gateway`, `caddy`. Só o Caddy publica porta |
| Banco | Postgres 16 no próprio compose, duas bases (`glucore_dev`, `glucore_auth_dev`) |
| Segredos | `deploy/.env.prod` na VM (`chmod 600`), gerados na própria VM; nunca no git |
| Backup | `pg_dump` das duas bases, criptografado (AES-256), todo dia às 3h, retenção de 14 dias, **só na própria VM** |

Verificado em 2026-10-04: HTTPS com certificado Let's Encrypt; 3000/3001/3002/5432 fechadas por fora; ciclo registro → `/me` → `POST/GET /readings` → `/dashboard/summary` → login → `DELETE /account` passou em produção; restauração de um backup em banco descartável (18 tabelas, 9 migrations). Depois do merge do PR #35: `publish-images` rodou na `main` e os 3 pacotes do GHCR estão públicos; `update.sh` foi executado na VM com as imagens do GHCR (pull e recriação em ~3 min, 3 serviços saudáveis); `POST /readings` com 501 leituras responde 400; backfill de sensor real (1.040 leituras, 11,5 dias) chegou inteiro ao servidor.

## Como uma mudança chega à produção

```
PR ─► CI (ci.yml) ─► merge na main ─► publish-images.yml ─► GHCR ─► VM: update.sh (cron diário às 23:59 de Brasília, ou à mão por SSH)
```

- `publish-images.yml` só roda depois que o `CI` passou na `main` (ou por `workflow_dispatch`, com o arquivo já na `main`). Builda as 3 imagens em `linux/amd64` e publica `ghcr.io/berdegeus/glucore-{auth,glucose,gateway}` com as tags `latest` e o SHA do commit. As imagens são **públicas** (o label `org.opencontainers.image.source` liga o pacote ao repositório); não contêm segredo.
- `backend/deploy/update.sh` faz `compose pull` + `up -d`; só recria o serviço cuja imagem mudou. As migrations Prisma rodam no boot do container do serviço (uma réplica só).
- Não há SSH de entrada para o GitHub; a VM busca, o GitHub não empurra.
- **Rollback:** `TAG=<sha>` no `deploy/.env.prod` + `./deploy/update.sh`. O cron mantém a tag até a linha ser removida.
- **Só existe um ambiente (produção).** Não há dev/test separados.

## Operação

```bash
ssh -i ~/.ssh/glucore_oci ubuntu@<ip-da-vm>
cd ~/glucore
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f --tail=100 gateway
./deploy/update.sh        # atualizar à mão
./deploy/backup.sh        # backup à mão
```

- Restaurar um backup: comando no fim de `backup.sh`. Teste sempre em um banco descartável antes.
- A VM não tem o repositório clonado: só `~/glucore/deploy/` e `~/glucore/docker/postgres/init-auth-db.sql`, copiados por `scp`. Mudou o compose ou o Caddyfile no repo? Copie de novo para a VM.
- O IP da VM e os OCIDs dos recursos ficam fora do git (repositório público).

## Web (Vercel)

A SPA em `web/` é publicada na Vercel e chama a API direto, sem proxy da Vercel: o limite de login do gateway é por IP, e um proxy faria todos os usuários compartilharem o IP da Vercel. Por isso o gateway precisa aceitar a origem da web no CORS.

**Configuração do projeto** (Vercel, Settings):

| Campo | Valor |
|---|---|
| Root Directory | `web` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch | `main` |
| Node.js Version | 22.x (o `engines` de `web/package.json` aceita `^22.13.0` ou 24+) |

**Variável de ambiente (Production):** `VITE_API_URL=https://glucore.duckdns.org`, só o host do gateway: **sem** `/api/v1` e **sem** barra final (a web acrescenta o prefixo `/api/v1` sozinha; ver `web/src/composition/container.ts` e `web/src/composition/env.ts`). A variável é lida no build e vai para o bundle, então nunca leva segredo. Exemplo de desenvolvimento em `web/.env.example`. Mudou a variável? Faça um novo deploy: o valor é embutido na hora do build.

**O que o `web/vercel.json` faz** (testado em `web/tests/deploy/vercelConfig.test.ts`):

- Fallback de SPA: qualquer rota sem extensão (`/paciente`, `/profissional/pacientes/abc`) responde `index.html` com `200`. `/assets/*` e caminhos com extensão **não** são reescritos, então um arquivo que sumiu é um `404` de verdade e não um HTML no lugar de um `.js`.
- Cabeçalhos em todas as respostas: `Content-Security-Policy` (`default-src 'self'`, `script-src 'self'` sem `unsafe-inline`, `style-src 'self'` com `style-src-attr 'unsafe-inline'` para os atributos `style` do Recharts, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` sem câmera, microfone e geolocalização.
- **Acoplamento com a API:** o `connect-src` da CSP lista `https://glucore.duckdns.org`. Esse é o mesmo host do `VITE_API_URL` (e o `API_URL` padrão do app em `lib/core/api/api_client.dart`). **Trocou o domínio da API (item 5 de "O que falta")? Mude o `connect-src` em `web/vercel.json`, o `VITE_API_URL` na Vercel e o `CORS_ORIGIN` na VM juntos.** Se só um mudar, o navegador bloqueia as chamadas e a web mostra erro de rede.
- Se uma tela futura precisar de mais estilo, relaxe só `style-src`; nunca `script-src`.

**Orçamento de peso:** `npm run size` (`web/scripts/checkBundleSize.mjs`) falha se o JavaScript da primeira carga passar de 250 kB gzip ou se trouxer Recharts/dnd-kit, que ficam em chunks sob demanda. Roda no job `web` do CI.

**Pular build quando `web/` não mudou (opcional).** Em Settings → Git → Ignored Build Step, ou como `ignoreCommand` em `web/vercel.json`:

```bash
git diff --quiet HEAD^ HEAD -- .
```

O comando roda dentro do Root Directory (`web`). Código de saída `0` pula o build, `1` builda. Sem esse passo, todo commit na `main` gera um deploy, inclusive os que só tocam o backend.

**CORS na VM.** A web só fala com a API se a origem dela estiver em `CORS_ORIGIN`. Na VM, em `~/glucore/deploy/.env.prod`:

```bash
CORS_ORIGIN=https://glucore.duckdns.org,https://<projeto>.vercel.app
```

Lista separada por vírgula, cada origem sem barra final (modelo em `backend/deploy/.env.prod.example`). O app mobile não envia `Origin` e não precisa constar. As URLs de preview da Vercel (`https://<projeto>-<hash>-<time>.vercel.app`) ficam **fora de propósito**: um preview carrega, mas o navegador bloqueia as chamadas à API. Para aplicar:

```bash
cd ~/glucore
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

O `up -d` recria só os serviços cuja configuração mudou (o gateway e os dois serviços internos recebem `CORS_ORIGIN`; ver `backend/deploy/docker-compose.prod.yml`). Confira com `curl -i -X OPTIONS https://glucore.duckdns.org/api/v1/me -H 'Origin: https://<projeto>.vercel.app' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'`: a resposta deve trazer `Access-Control-Allow-Origin` com a origem da web e `authorization` em `Access-Control-Allow-Headers`.

**Rollback da web.** Vercel, aba Deployments: abra o último deploy bom e use "Promote to Production" (ou "Instant Rollback" no deploy de produção atual). Não precisa de commit. Para desfazer o CORS, volte `CORS_ORIGIN` ao valor anterior e rode o `up -d` acima. O rollback do backend segue o `TAG=<sha>` descrito em "Como uma mudança chega à produção".

### AÇÃO MANUAL DO USUÁRIO (o agente não faz isto)

Criar e conectar o projeto na Vercel exige a conta do dono; o agente não conecta contas, não faz deploy e não mexe na VM de produção. Checklist:

- [ ] Em vercel.com, **Add New → Project**, importar o repositório do GitHub (autorizar o app da Vercel só neste repositório).
- [ ] **Root Directory** `web`; **Framework Preset** Vite; **Install Command** `npm ci`; **Build Command** `npm run build`; **Output Directory** `dist`.
- [ ] Settings → General → **Node.js Version** 22.x.
- [ ] Settings → Environment Variables → `VITE_API_URL=https://glucore.duckdns.org` (Production; sem `/api/v1`, sem barra final).
- [ ] Settings → Git → **Production Branch** `main`. Opcional: **Ignored Build Step** com o comando acima.
- [ ] Anotar a URL de produção que a Vercel gerou (por exemplo `https://glucore-web.vercel.app`).
- [ ] Na VM, acrescentar essa origem em `CORS_ORIGIN` no `deploy/.env.prod` e rodar o `docker compose ... up -d` acima.
- [ ] Abrir a URL de produção, entrar com uma conta de paciente e conferir no console do navegador que não há erro de CSP nem de CORS; abrir `/paciente` direto (recarregar a página) e ver a SPA, não um `404`.
- [ ] Depois do primeiro deploy bom, ligar a proteção de branch na `main` exigindo o job `web` do CI (se ainda não estiver).

## Riscos conhecidos

- **Ociosidade:** a Oracle pode recuperar uma VM Always Free com CPU/rede abaixo de 20% (percentil 95) por 7 dias. Com o app em uso tende a não ocorrer; se o app ficar parado, acesse a conta e a VM de vez em quando.
- **1 GB de RAM:** a stack usa ~530 MB; o swap é a reserva. Build de imagem **não** se faz na VM.
- **Sem alta disponibilidade:** uma VM, um Postgres. Reiniciar a VM derruba tudo por ~1 min (`restart: unless-stopped` volta sozinho).
- **ARM não obtido:** `VM.Standard.A1.Flex` respondeu `Out of host capacity` em São Paulo. Se migrar, publicar também `linux/arm64` (`platforms:` no workflow).
- **Cota da conta:** o tenancy mostra cota de A1 acima do grátis (conta provavelmente pay-as-you-go): não criar recurso fora do Always Free.

## O que falta (acompanhado na issue de deploy)

1. **Aviso de falha do deploy automático.** O cron (`59 2 * * *` UTC = 23:59 de Brasília, log em `~/glucore-update.log` na VM) atualiza a produção sozinho com o que estiver na `main` com CI verde, e ninguém é avisado se falhar. Decidir a frequência e como ser avisado (depende do SMTP, item 4).
3. **Backup fora da VM** (Object Storage grátis de 20 GB ou outra cópia). Guardar a `BACKUP_PASSPHRASE` fora da VM.
4. **SMTP**: sem ele, "esqueci minha senha" imprime o token no log da VM.
5. Domínio próprio no lugar do DuckDNS (troca `API_HOST`, `CORS_ORIGIN` e o `API_URL` do app).
6. `helmet` no gateway; Dockerfiles multi-stage (imagens de ~190 MB comprimidas, ~720 MB na VM).
7. Ambientes dev/test e migrations como job separado, para subir o tier da rubrica #39.
8. Gerar o APK de **release** apontando para a URL de produção. A sincronização contra a produção já foi validada com o APK de debug em 2026-10-04 (o `API_URL` padrão do app é a URL de produção).
