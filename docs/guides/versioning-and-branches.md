# Versionamento e branches

> Quando usar: antes de abrir PR, versionar ou decidir para onde uma mudança vai.

Adotado na v1.1.0 (2026-07-30). Muito código é escrito sem teste em hardware
real; **nada não-testado vai direto para `main`**.

## Versionamento

- Semântico `MAJOR.MINOR.PATCH` em `pubspec.yaml` (`version: X.Y.Z+build`).
- O `+build` (versionCode Android) incrementa a cada release.
- Cada versão liberada em `main` recebe uma tag `vX.Y.Z`.

## Branches

| Branch | Papel |
|---|---|
| `main` | Só versões estáveis, **testadas no app**. Cada merge = release + tag `vX.Y.Z`. |
| `dev` | Branch de **integração** da versão em andamento. Trabalho acumula aqui. |
| `feat/*`, `fix/*`, `docs/*` | Branches de trabalho. PR para `dev`. |

## Fluxo por versão

```
feat/… ─PR─▶ dev  ─PR─▶ dev  ─PR─▶ dev
                    │
                    ▼  (teste regressivo no dispositivo em `dev`)
                   main  + tag vX.Y.Z
```

1. Trabalho numa branch `feat/*` ou `fix/*` → **PR para `dev`**.
2. Mergeia em `dev`; `dev` acumula a versão em andamento.
3. Quando a versão passa no **teste regressivo em hardware real** (rodando o app
   a partir de `dev`): abre **um** PR `dev → main`, mergeia e cria a tag `vX.Y.Z`.
4. Bump do `pubspec` no início de cada nova versão (commit `chore(release)`).

## Histórico

- **v1.1.0** — multi-sensor (Libre 2 + Accu-Chek) + correções P17/P18/P19.
  Integrada em `dev` via PR #7 (2026-07-30). Ver [CHANGELOG.md](../../CHANGELOG.md).
