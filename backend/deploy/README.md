# Deploy do backend em uma VM (Oracle Always Free + DuckDNS + Caddy)

Stack: Caddy (HTTPS) → gateway → auth-service / glucose-service → Postgres, tudo em um compose.
Só as portas 80/443 ficam abertas. O mesmo compose serve para qualquer VM Linux (plano B: Hetzner CAX11).

## 1. VM (manual, no console da Oracle)
- Shape `VM.Standard.A1.Flex` (ARM), 2 OCPU / 12 GB, Ubuntu 22.04 ou 24.04, chave SSH sua.
- Na Security List (ou NSG) da subnet, libere entrada TCP **80 e 443** (e 22 só para o seu IP, se possível). Não libere 3000, 3001, 3002 nem 5432.
- Na VM, o Ubuntu da Oracle traz regras de iptables restritivas. Libere 80/443 também lá:
  ```bash
  sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```
- Anote o IP público. Se a VM ficar parada ou sem uso por muito tempo, a Oracle pode recuperá-la: acesse a conta de vez em quando.

## 2. DuckDNS
Crie um subdomínio em duckdns.org apontando para o IP público da VM (ex.: `glucore-xyz.duckdns.org`).
Serve para homologação. Para uso real, troque por domínio próprio: só muda `API_HOST`, `CORS_ORIGIN` e o `API_URL` do app.

## 3. Docker na VM
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # saia e entre de novo na sessão SSH
```

## 4. Código e segredos
```bash
git clone <url-do-repo> Glucore && cd Glucore/backend
cp deploy/.env.prod.example deploy/.env.prod
# Gere cada valor com: openssl rand -hex 32
#   POSTGRES_PASSWORD, JWT_SECRET, INTERNAL_JWT_SECRET (os dois JWT precisam ser diferentes)
# Preencha API_HOST=<sub>.duckdns.org e CORS_ORIGIN=https://<sub>.duckdns.org
chmod 600 deploy/.env.prod
```
`deploy/.env.prod` está no `.gitignore`. Guarde uma cópia dos segredos num gerenciador de senhas: perder `JWT_SECRET` desloga todos; perder a senha do banco após criado exige reset dentro do Postgres.

## 5. Subir
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps
curl https://<sub>.duckdns.org/health/live
```
O primeiro build leva alguns minutos (cada imagem compila os três serviços). O Caddy emite o certificado sozinho quando o DNS já aponta para a VM e a 80/443 estão abertas.

## 6. SMTP
Sem `SMTP_HOST/USER/PASS`, "esqueci minha senha" imprime o token no log em vez de mandar e-mail. Preencha os três com um provedor de sua escolha e rode `up -d` de novo.

## 7. Backup
```bash
echo "BACKUP_PASSPHRASE=$(openssl rand -hex 32)" > deploy/.env.backup && chmod 600 deploy/.env.backup
./deploy/backup.sh                       # teste manual
crontab -e                               # 0 3 * * * /home/ubuntu/Glucore/backend/deploy/backup.sh >> /var/log/glucore-backup.log 2>&1
```
Sem `BACKUP_UPLOAD_CMD` o backup fica só na própria VM, o que não protege contra perder a VM. Configure o envio para Object Storage (20 GB grátis) e guarde a passphrase fora da VM. **Teste uma restauração** (comando no fim do `backup.sh`) antes de confiar no backup.

## 8. App
```bash
flutter build apk --release --dart-define=API_URL=https://<sub>.duckdns.org
```
Passe só o host, sem `/api/v1`.

## CI/CD: como uma mudança chega à produção
Não se builda na VM (1 GB de RAM). O fluxo é:

1. PR → `CI` (`.github/workflows/ci.yml`) roda análise, testes e typecheck.
2. Merge na `main` (releases testadas) → o `CI` passa → `publish-images.yml` builda as 3 imagens (`linux/amd64`, com cache) e publica no GHCR como `ghcr.io/berdegeus/glucore-{auth,glucose,gateway}`, com as tags `latest` e o SHA do commit.
3. A VM roda `deploy/update.sh` a cada 5 minutos: `compose pull` + `up -d`. Só recria o serviço cuja imagem mudou; as migrações rodam no boot dele. Não há SSH de entrada para o GitHub.

**Ativar na VM** (uma vez, depois que o primeiro `publish-images` rodar):
```bash
# Pacotes privados: crie um PAT clássico só com read:packages
echo <PAT> | docker login ghcr.io -u Berdegeus --password-stdin
crontab -e   # */5 * * * * /home/ubuntu/glucore/deploy/update.sh >> /home/ubuntu/glucore-update.log 2>&1
```
Se preferir pacotes públicos (a imagem não contém segredos, só o código compilado), o `login` é dispensável.

**Rollback:** ponha `TAG=<sha-anterior>` no `deploy/.env.prod` e rode `./deploy/update.sh`. O cron mantém essa tag até você remover a linha.

**Primeiro deploy sem registry** (foi como a VM subiu): na máquina de desenvolvimento,
`docker buildx build --platform linux/amd64 -f services/<svc>/Dockerfile -t ghcr.io/berdegeus/glucore-<img>:latest --load .`
e `docker save <imagens> | gzip | ssh ubuntu@<ip> 'gunzip | sudo docker load'`; depois `up -d --no-build --pull never`
(baixe antes `postgres` e `caddy` com `compose pull postgres caddy`).

> A VM `E2.1.Micro` é **x86_64**. Se migrar para o ARM (`A1.Flex`), publique `linux/arm64` também (`platforms:` no workflow).

## Atualizar à mão
```bash
./deploy/update.sh
```

## Verificação
- `curl https://<sub>.duckdns.org/health/live` → 200.
- De fora da VM, `curl http://<ip>:3001`, `:3002`, `:5432` → conexão recusada ou timeout.
- 11 logins errados seguidos pelo gateway → 429.
- Reinicie a VM: a stack volta sozinha (`restart: unless-stopped`) e os dados persistem.
