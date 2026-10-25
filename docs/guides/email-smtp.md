# E-mail de recuperação de senha (SMTP com Brevo)

O auth-service envia o e-mail de "esqueci minha senha" por SMTP. O provedor recomendado é o **Brevo** (plano grátis, 300 e-mails/dia, funciona com remetente verificado — não exige domínio próprio, o que importa porque `glucore.duckdns.org` não permite criar registros DKIM/SPF). Plano B: Gmail.

Sem SMTP configurado, o token de reset é impresso no log do serviço (`ConsoleMailer`). Isso é uma escolha de configuração, não um fallback de erro: com SMTP configurado, uma falha de envio é registrada no log e na auditoria (`FORGOT_PASSWORD_DELIVERY_FAILED`), e o cliente recebe a mesma resposta neutra.

## 1. Criar a conta no Brevo

1. Acesse <https://www.brevo.com> → **Sign up free**, confirme o e-mail e escolha o plano **Free**.
2. **Remetente:** *Senders, Domains & Dedicated IPs* → **Senders** → *Add a sender*. Informe um e-mail que você controla; o Brevo manda um código de verificação para ele. Esse e-mail é o `SMTP_FROM`.
3. **Credenciais:** menu do usuário (canto superior direito) → **SMTP & API** → aba **SMTP**.
   - Servidor `smtp-relay.brevo.com`, porta `587`.
   - **Login** (algo como `abc123@smtp-brevo.com`; não é o seu e-mail) → `SMTP_USER`.
   - **Generate a new SMTP key** → copie na hora, só aparece uma vez → `SMTP_PASS`.
4. Contas novas podem ficar em validação por algumas horas antes de liberar o envio.

## 2. Variáveis

No `backend/services/auth-service/.env` (local) ou no `.env` de `backend/deploy/` (produção):

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<login SMTP do Brevo>
SMTP_PASS=<chave SMTP>
SMTP_FROM=<remetente verificado no passo 1.2>
WEB_APP_URL=https://glucore.vercel.app
```

`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` são obrigatórios em conjunto; faltando qualquer um, o serviço usa o `ConsoleMailer`. `WEB_APP_URL` é a origem da web: o e-mail linka para `<WEB_APP_URL>/redefinir-senha?token=…`; sem ela, traz só o código (o app Flutter usa o código). Nunca commite a chave SMTP.

A porta 587 usa STARTTLS obrigatório; a 465 usa TLS direto. A porta 25 é bloqueada pela Oracle.

## 3. Produção (VM)

```bash
cd ~/glucore/backend/deploy        # onde está o .env
docker compose -f docker-compose.prod.yml up -d auth-service
docker compose -f docker-compose.prod.yml logs auth-service | grep -i smtp   # não deve aparecer "no SMTP configured"
```

Confira também que `CORS_ORIGIN` do gateway lista a origem da web.

## 4. Testar

Peça "Esqueci minha senha" (web em `/esqueci-a-senha` ou app) com um e-mail cadastrado. Olhe a caixa de entrada **e o spam**: sem domínio próprio, as primeiras mensagens podem cair lá. O painel *Transactional → Logs* do Brevo mostra entregue/bloqueado.

## Plano B: Gmail

Ative a verificação em duas etapas, crie uma *Senha de app* em <https://myaccount.google.com/apppasswords> e use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=SMTP_FROM=<seu gmail>`, `SMTP_PASS=<senha de app>`. Limite de ~500 e-mails/dia.
