# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Quando um AC fixa um limite numérico (min 8 caracteres, 600 dp), a tabela de casos precisa de uma amostra imediatamente abaixo e outra exatamente no limite; sem isso a constante pode derivar com a suíte verde.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `testing/boundaries` · harmful: 0
- features: checklist-tcc-compliance
- evidence: design.md:93-102 (tabela de casos da política de senha) (testing/boundaries)
- last seen: 2026-08-17T01:59:16Z

### L-002 - AC com quantificador global ('nenhuma tela', 'nenhuma ocorrência em lib/') exige uma tarefa cujo Done-when seja o próprio grep global; se as tarefas só listam arquivos nomeados, o AC nasce impossível de cumprir.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `planning/scope` · harmful: 0
- features: checklist-tcc-compliance
- evidence: spec.md P2 Mensagens AC2 / P3 Visual AC2 (planning/scope)
- last seen: 2026-08-17T01:59:17Z

### L-003 - Ao criar um widget compartilhado obrigatório por AC, enumerar os call sites com um grep do padrão antigo (obscureText, SnackBar, Colors.red) e citar a contagem no Done-when, em vez de confiar na lista de telas da tarefa.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `planning/tasks` · harmful: 0
- features: checklist-tcc-compliance
- evidence: lib/features/patient/presentation/pages/profile_edit_page.dart:340-348 (P1 AC5) (planning/tasks)
- last seen: 2026-08-17T01:59:17Z

### L-004 - Copiar um literal de uma tela legada para um widget novo cria um passivo: se uma tarefa posterior migrar aquela tela para l10n, o widget novo fica como única fonte do literal — usar l10n desde a criação.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `flutter/l10n` · harmful: 0
- features: checklist-tcc-compliance
- evidence: lib/features/patient/presentation/widgets/user_app_bar.dart:91,95 (P3 AC1) (flutter/l10n)
- last seen: 2026-08-17T01:59:17Z

### L-005 - AC de higiene fechado por grep (SnackBar, Colors.red, literal em l10n) precisa de um teste estrutural que leia o fonte do arquivo migrado; sem isso o padrao antigo volta sem quebrar a suite, porque o valor l10n e identico ao literal.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `testing/regression-guards` · harmful: 0
- features: checklist-tcc-compliance
- evidence: lib/features/patient/presentation/widgets/user_app_bar.dart:91 (testing/regression-guards)
- last seen: 2026-08-17T16:09:04Z

### L-006 - Um caso de teste so prova um gate novo se o valor escolhido passar por todas as validacoes a montante e for barrado apenas pela nova regra. Aqui o teste com valor 4 (codigo de protocolo) sobreviveu a remocao do gate de 0x10000, porque 4 ja e barrado pela faixa 400..6000; quem discrimina e 1043, glicose plausivel sem bits de rate/alarm.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `testing` · harmful: 0
- features: arch-phases-0-2-gaps
- evidence: .specs/features/arch-phases-0-2-gaps/validation.md (testing)
- last seen: 2026-08-21T00:41:13Z

### L-007 - Edicao de documento por str.replace do Python substitui TODAS as ocorrencias: um marcador de status que se repete por item (ex.: '**Parcial (data):**' em cada problema do review) foi sobrescrito em 4 itens de uma vez, marcando tres problemas nao resolvidos como resolvidos. Ao editar marcador repetido, ancore por secao/linha e confirme a contagem de ocorrencias antes e depois.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tooling` · harmful: 0
- features: arch-phases-0-2-gaps
- evidence: .specs/features/arch-phases-0-2-gaps/validation.md (tooling)
- last seen: 2026-08-21T00:41:13Z

### L-008 - Uma AC de concorrencia ('editar durante um push em andamento') so conta como coberta com um teste que dispara a operacao longa sem await e escreve no meio; ler o mecanismo e confirmar que a mutacao adjacente morre nao substitui a assercao direta.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `test/features/patient` · harmful: 0
- features: arch-phases-3-5
- evidence: SYNC-07 (test/features/patient)
- last seen: 2026-08-30T01:06:00Z

### L-009 - AC com duas metades ('a preferencia fica em system' E 'o app segue o SO') precisa de assercao para as duas; delegar a metade nao asserida ao framework deixa o caso de borda declarado na spec sem teste.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `test/core/theme` · harmful: 0
- features: arch-phases-3-5
- evidence: THEME-03 (test/core/theme)
- last seen: 2026-08-30T01:06:00Z

### L-010 - AC que fixa a granularidade do commit ('atualizar o doc no mesmo commit') e violada por um commit de documentacao no fim da iteracao; ou o doc entra junto com a mudanca de contrato, ou a AC nao deve prometer o acoplamento por commit.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `docs/reference` · harmful: 0
- features: arch-phases-3-5
- evidence: PLAN-04 (docs/reference)
- last seen: 2026-08-30T01:06:00Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
