# sarahperes-pages

Workspace local de estudo com:

- gerador de mapas mentais
- editor visual de mapas
- backend local seguro para OpenAI
- workspace da hipofise com mapa + questoes + revisao
- PWA lite para uso offline basico

## Uso local seguro

1. Rode `start-secure-local.cmd`
2. Abra `http://127.0.0.1:8787/hipofise-workspace.html`
3. Para ir ao gerador: `http://127.0.0.1:8787/gerador-estudo.html`
4. Para abrir o editor: `http://127.0.0.1:8787/mapa-estudo-editor.html`

A chave da OpenAI pode ficar em `.env.local` ou em variaveis de ambiente do Windows lidas pelo servidor local `local-secure-server.mjs`.

Variaveis aceitas:

- `OPENAI_API_KEY`
- `ADMKEY`
- `LUCASJOGA`

## Arquivos principais

- `hipofise-workspace.html`
- `hipofise-estudo.json`
- `questoes-hipofise.json`
- `mapa-estudo-editor.html`
- `gerador-estudo.html`
- `local-secure-server.mjs`
- `manifest.json`
- `sw.js`

## Observacao

O estudo offline cobre mapa, quiz e revisao. Funcoes de IA dependem do backend local seguro e de internet.
