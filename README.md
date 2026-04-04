# sarahperes-pages

Portal unico para estudo, geracao e edicao de mapas mentais com:

- portal principal
- workspace de estudo
- gerador avancado de mapas
- editor visual de mapas
- pagina AmyMind
- OCR local para imagem
- gateway local seguro
- PWA lite para uso offline basico

## Uso local

1. Configure `.env.local` com:
   - `AI_PROVIDER=openai`
   - `OPENAI_API_KEY=...`
   - `SITE_OPENAI_MODEL=gpt-4.1-mini`
   - `BOT_OPENAI_MODEL=gpt-4.1-mini`
   - `API_ACCESS_PASSWORD=324125`
2. Rode `start-secure-local.cmd`
3. Abra `http://127.0.0.1:8787/`

Links locais principais:

- portal: `http://127.0.0.1:8787/`
- workspace: `http://127.0.0.1:8787/hipofise-workspace.html`
- gerador: `http://127.0.0.1:8787/gerador-estudo.html?advanced=1`
- editor: `http://127.0.0.1:8787/mapa-estudo-editor.html`
- AmyMind: `http://127.0.0.1:8787/sitepra.html`
- bot local: `powershell -ExecutionPolicy Bypass -File .\ask-local-bot.ps1`

## Config local

O gateway local le:

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `SITE_OPENAI_MODEL`
- `BOT_OPENAI_MODEL`
- `API_ACCESS_PASSWORD`

Use `.env.local` ou variaveis de ambiente do Windows.

Padrao recomendado:

- `AI_PROVIDER=openai`
- `SITE_OPENAI_MODEL=gpt-4.1-mini`
- `BOT_OPENAI_MODEL=gpt-4.1-mini`

## Rotas locais

- `POST /api/openai/responses`
  - mantida por compatibilidade, responde via backend seguro
- `POST /api/bot/responses`
  - usa o modelo do perfil bot no backend seguro
- `GET /api/health`
  - informa host, provider, modelos configurados e disponibilidade do backend

## Observacoes

- PDF continua sendo convertido com `pdf.js`
- imagem continua sendo convertida por OCR local no navegador
- a geracao e o tutor usam o backend local seguro, sem chave no front-end
- a chave fica so em `.env.local` ou na variavel de ambiente do Windows
- se quiser trocar o modelo, ajuste apenas o `.env.local`
