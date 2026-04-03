# sarahperes-pages

Portal unico de estudo e mapas mentais com:

- gerador de mapas mentais
- editor visual de mapas
- backend local seguro para OpenAI
- workspace da hipofise com mapa + questoes + revisao
- PWA lite para uso offline basico
- home hub com entrada unica para todos os sites

## Uso local seguro

1. Rode `start-secure-local.cmd`
2. Abra `http://127.0.0.1:8787/`
3. Para ir ao workspace: `http://127.0.0.1:8787/hipofise-workspace.html`
4. Para ir ao gerador: `http://127.0.0.1:8787/gerador-estudo.html`
5. Para abrir o editor: `http://127.0.0.1:8787/mapa-estudo-editor.html`
6. Para abrir o site AmyMind: `http://127.0.0.1:8787/sitepra.html`
7. Para testar o perfil do bot: `powershell -ExecutionPolicy Bypass -File .\ask-local-bot.ps1`

A chave da OpenAI pode ficar em `.env.local` ou em variaveis de ambiente do Windows lidas pelo servidor local `local-secure-server.mjs`.

Variaveis aceitas:

- `OPENAI_API_KEY` ou `SITE_OPENAI_API_KEY` para o site
- `BOT_OPENAI_API_KEY` ou `OPENAI_BOT_API_KEY` para o bot local
- `ADMKEY` como fallback legado do site
- `LUCASJOGA` como fallback legado do bot

## Perfis locais

- A API local agora exige uma senha de acesso via header `x-api-password`.
- Se `API_ACCESS_PASSWORD` nao estiver definida no ambiente local, o servidor usa `324125`.
- `POST /api/openai/responses` usa o perfil do site.
- `POST /api/openai/responses` tenta o perfil do site primeiro e cai para o perfil do bot se a chave do site estiver invalida.
- `POST /api/bot/responses` usa o perfil do bot.
- `GET /api/health` informa se os dois perfis estao configurados.

## Arquivos principais

- `index.html`
- `sitepra.html`
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
