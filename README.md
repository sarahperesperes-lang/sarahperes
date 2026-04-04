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

## Copia ativa

Use `C:\Users\a8912\WebstormProjects\sarahperes` como fonte de verdade do backend local.

- O servidor em `http://127.0.0.1:8787` deve ser iniciado desta pasta.
- A copia em `D:\sarahperes-pages` pode existir como espelho de publicacao, mas nao deve ser usada para subir o gateway local.
- `GET /api/health` agora retorna `projectRoot` para mostrar qual copia esta servindo a porta `8787`.

## Uso local

1. Garanta que o Ollama esteja rodando em `http://127.0.0.1:11434`.
2. Confirme que o modelo principal existe:
   - `ollama run glm-4.7-flash:latest`
3. Garanta que o fallback exista:
   - `ollama run llama3:latest`
4. Rode `start-secure-local.cmd` a partir de `C:\Users\a8912\WebstormProjects\sarahperes`.
5. Abra `http://127.0.0.1:8787/`.
6. Se quiser abrir gateway + Codex numa vez so, use `start-codex-llama3.cmd`.

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
- `OLLAMA_FALLBACK_NUM_CTX`
- `OLLAMA_PRIMARY_TIMEOUT_MS`
- `OLLAMA_FALLBACK_TIMEOUT_MS`
- `OLLAMA_PRIMARY_COOLDOWN_MS`
- `API_ACCESS_PASSWORD`

Use `.env.local` ou variaveis de ambiente do Windows.

Padrao recomendado nesta maquina:

- `SITE_OLLAMA_MODEL=glm-4.7-flash:latest`
- `BOT_OLLAMA_MODEL=glm-4.7-flash:latest`
- `OLLAMA_FALLBACK_MODEL=llama3:latest`
- `OLLAMA_NUM_CTX=2048`
- `OLLAMA_FALLBACK_NUM_CTX=1024`

## Rotas locais

- `POST /api/openai/responses`
  - mantida por compatibilidade, mas responde via Ollama local
- `POST /api/bot/responses`
  - usa o modelo do bot local
- `GET /api/health`
  - informa host, raiz ativa, modelos configurados, modelo resolvido e fallback

## Observacoes

- PDF continua sendo convertido com `pdf.js`.
- Imagem continua sendo convertida por OCR local no navegador.
- A geracao e o tutor usam Ollama local, sem chave no front-end.
- `glm-4.7-flash:latest` continua como modelo preferido, mas nesta maquina ele nao entra de forma estavel sem mais memoria virtual.
- Quando `glm-4.7-flash:latest` falha ou excede o timeout, o gateway cai automaticamente para `llama3:latest`.
- Se quiser usar `glm-4.7-flash:latest` como modelo real do site, aumente o pagefile do Windows ou reduza a pressao de RAM e depois ajuste `OLLAMA_PRIMARY_TIMEOUT_MS`.
