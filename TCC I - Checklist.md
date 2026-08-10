## Aplicação – Checklist

## Front End

## Identidade visual única em toda a aplicação (interface)

Todas as telas possuem mesmo padrão de cores, fontes, imagens e ícones.

Todas as telas exibem usuário logado (nome, perfil) e opção de logout (Sair).

Todas as telas permitem algum grau de responsividade.

Todas as mensagens ao usuário seguem o mesmo padrão da identidade visual da interface, tanto

para exibir informação (info), aviso (warning) ou erro (error).

## Validação de Dados (input apenas de dados validados)

Todas os campos de entrada orientam seu preenchimento.

Todas os campos de entrada indicam se são ou não obrigatórios.

Apenas aceita senhas fortes (exige no mínimo 8 caracteres, variedade de letras maiúsculas e minúsculas, números e caractere especial).

Não permite cadastro de dados únicos duplicados, como CPF, CNPJ, CRM, CREA, e-mail, usuário para login, etc.

Permite visualizar senha

Desejável: Permite confirmar senha.

Desejável: máscara telefone, CPF, CNPJ, CEP, etc.

Desejável: obtém endereço a partir de CEP válido1. [URL 🔗](#page-0)


## Back End

## Funcionalidades

Login permite recuperação de usuário e recuperação de senha.

Desejável: habilitar / desabilitar autenticação em 2 fatores (Two-Factor Authentication - 2FA).

## Persistência

Senha é criptografada no BD.

- BD geral: entidades fortes são nomeadas como substantivos.

- BD relacional: entidades estão relacionadas (PK x FK).

- BD relacional: diagrama gerado por engenharia reversa (BD implementado).

- Aplicação trata erros de BD: avisa o usuário (BD fora de serviço, dados únicos duplicados, ...).

- DELETE: solicita confirmação antes da exclusão de registro.

- UPDATE: formulários para edição estão preenchidos com os dados persistidos em BD

Diferencia dados editáveis (telefone, endereço, ... ) de dados não editáveis (CPF, CNPJ, ...)

- UPDATE de senha: não apresenta a senha criptografada para atualização (campo vazio)

Criptografia de HASH é irreversível, logo a senha criptografada não pode ser revertida / recuperada para edição.

- Desejável: UPDATE de senha em tela exclusiva para trocar senha.

- Desejável: log para auditoria.

## Sessão

Faz tratamento de restrição de acesso: telas ou funcionalidade são acessíveis apenas a usuários com a devida permissão, ou seja, existe bloqueio de acesso para usuários sem permissão. Nesse caso, o usuário sem permissão é redirecionado à tela apropriada (tela inicial ou tela de login).

Expira sessão quando não há atividade do usuário logado – existe timeout de inatividade.
