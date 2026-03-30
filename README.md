# Glucore (Flutter + Clean Architecture)

Setup inicial de projeto Flutter com autenticação local (sessão) usando `SharedPreferences` e estrutura em Clean Architecture.

## O que foi implementado

- Estrutura por camadas:
  - `features/auth/domain`
  - `features/auth/data`
  - `features/auth/presentation`
- Caso de uso de login e logout.
- Persistência local da sessão (`is_logged_in`) via `SharedPreferences`.
- `AuthCubit` para controle de estado na apresentação.
- Injeção de dependências com `get_it` no bootstrap do app.
- UI inicial com:
  - `LoginPage`
  - `HomePage`
  - Navegação por estado (autenticado vs não autenticado).

## Como rodar

> Neste ambiente de automação não há SDK Flutter instalado. Na sua máquina local:

1. Instale Flutter SDK.
2. Na raiz do projeto:

```bash
flutter pub get
flutter run
```

## Próximos passos recomendados

- Injetar dependências com `get_it`.
- Adicionar validação robusta de formulário.
- Trocar autenticação fake por API real (token + refresh).
- Cobertura de testes para Cubit e camada data.
