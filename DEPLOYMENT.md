# Fluxo de publicação do Símbolos

- `development`: mudanças novas e experimentos.
- `stable`: última versão aprovada.
- `main`: pacote final validado.
- `gh-pages`: espelho público de `main`, mantido porque esta é a fonte já usada pelo GitHub Pages neste projeto.

## Regra de segurança
Mudanças funcionais novas devem ser testadas primeiro em `/beta/`. O Oficial só recebe mudanças aprovadas. A Beta usa `simbolos.beta.library.v2`; o Oficial usa `simbolos.library.v2`.

Antes de publicar, execute `node scripts/validate-release.mjs`. O workflow `Validate release` executa a mesma validação no GitHub.

Nunca use limpeza geral dos dados do Safari como primeira ação. Use `recover.html` e `safe.html` antes de qualquer medida destrutiva.
