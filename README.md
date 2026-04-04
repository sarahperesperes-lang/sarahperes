# sarahperes-pages

Portal unico de estudo e mapas mentais com:

- portal principal
- gerador de mapas mentais
- editor visual de mapas
- workspace da hipofise com mapa + questoes + revisao
- OCR local para imagem
- gateway local para Ollama
- PWA lite para uso offline basico

## Uso local

1. Garanta que o Ollama esteja rodando em `http://127.0.0.1:11434`
2. Confirme que o modelo principal existe:
   - `ollama run llama3:latest`
3. Rode `start-secure-local.cmd`
4. Abra `http://127.0.0.1:8787/`

Links locais:

- portal: `http://127.0.0.1:8787/`
- workspace: `http://127.0.0.1:8787/hipofise-workspace.html`
- gerador: `http://127.0.0.1:8787/gerador-estudo.html`
- editor: `http://127.0.0.1:8787/mapa-estudo-editor.html`
- AmyMind: `http://127.0.0.1:8787/sitepra.html`
- bot local: `powershell -ExecutionPolicy Bypass -File .\ask-local-bot.ps1`

## Config local

O gateway local le:

- `OLLAMA_HOST`
- `SITE_OLLAMA_MODEL`
- `BOT_OLLAMA_MODEL`
- `OLLAMA_NUM_CTX`
- `API_ACCESS_PASSWORD`

Use `.env.local` ou variaveis de ambiente do Windows.

## Rotas locais

- `POST /api/openai/responses`
  - mantida por compatibilidade, mas agora responde via Ollama local
- `POST /api/bot/responses`
  - usa o modelo do bot local

Se quiser insistir em `codellama`, ajuste `SITE_OLLAMA_MODEL` e `BOT_OLLAMA_MODEL` no `.env.local`.
- `GET /api/health`
  - informa host, modelos configurados e disponibilidade do Ollama

## Observacao

- PDF continua sendo convertido com `pdf.js`
- imagem agora usa OCR local no navegador
- geracao e tutor usam Ollama local, sem chave no front-end
