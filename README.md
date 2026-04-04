# sarahperes-pages

Portal unico para estudo, geracao e edicao de mapas mentais com:

- portal principal
- workspace de estudo
- gerador avancado de mapas
- editor visual de mapas
- pagina AmyMind
- OCR local para imagem
- gateway local com Ollama
- PWA lite para uso offline basico

## Uso local

1. Garanta que o Ollama esteja rodando em `http://127.0.0.1:11434`
2. Confirme que o modelo principal existe:
   - `ollama run codellama:13b-code-q4_K_M`
3. Garanta que o fallback tambem exista:
   - `ollama run llama3:latest`
4. Rode `start-secure-local.cmd`
5. Abra `http://127.0.0.1:8787/`

Links locais principais:

- portal: `http://127.0.0.1:8787/`
- workspace: `http://127.0.0.1:8787/hipofise-workspace.html`
- gerador: `http://127.0.0.1:8787/gerador-estudo.html?advanced=1`
- editor: `http://127.0.0.1:8787/mapa-estudo-editor.html`
- AmyMind: `http://127.0.0.1:8787/sitepra.html`
- bot local: `powershell -ExecutionPolicy Bypass -File .\ask-local-bot.ps1`

## Config local

O gateway local le:

- `OLLAMA_HOST`
- `SITE_OLLAMA_MODEL`
- `BOT_OLLAMA_MODEL`
- `OLLAMA_FALLBACK_MODEL`
- `OLLAMA_NUM_CTX`
- `API_ACCESS_PASSWORD`

Use `.env.local` ou variaveis de ambiente do Windows.

Padrao recomendado:

- `SITE_OLLAMA_MODEL=codellama:13b-code-q4_K_M`
- `BOT_OLLAMA_MODEL=codellama:13b-code-q4_K_M`
- `OLLAMA_FALLBACK_MODEL=llama3:latest`

## Rotas locais

- `POST /api/openai/responses`
  - mantida por compatibilidade, mas agora responde via Ollama local
- `POST /api/bot/responses`
  - usa o modelo do bot local
- `GET /api/health`
  - informa host, modelos configurados, fallback e disponibilidade do Ollama

## Observacoes

- PDF continua sendo convertido com `pdf.js`
- imagem continua sendo convertida por OCR local no navegador
- a geracao e o tutor usam Ollama local, sem chave no front-end
- `codellama:13b-code-q4_K_M` e o modelo preferido para o site
- se o runner do codellama falhar, o gateway cai automaticamente para `llama3:latest`
- se quiser trocar o modelo, ajuste apenas o `.env.local`
