#!/usr/bin/env python3
"""
PDF -> mapa mental denso para uso médico / DSM / prova.

Requisitos:
- pypdf para leitura
- openai (client.responses.create)
- saída em TXT e JSON
- chunking semântico simples
- unificação final em um mapa único
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from string import Template
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

from openai import OpenAI
from pypdf import PdfReader


MIN_MODEL = "gpt-4.1-mini"
BIG_MODEL = "gpt-4.1"
BIG_TEXT_THRESHOLD = 35_000
CHUNK_TARGET = 9_000
CHUNK_MAX = 12_000
DEFAULT_OUTPUT_BASENAME = "mapa_mental"


@dataclass
class MindMapNode:
    nome: str
    subtopicos: list["MindMapNode"] = field(default_factory=list)

    def dedupe(self) -> "MindMapNode":
        seen: set[str] = set()
        unique: list[MindMapNode] = []
        for child in self.subtopicos:
            child = child.dedupe()
            key = normalize_key(child.nome)
            if key in seen:
                continue
            seen.add(key)
            unique.append(child)
        self.subtopicos = unique
        return self

    def to_dict(self) -> dict[str, Any]:
        return {
            "nome": self.nome,
            "subtopicos": [child.to_dict() for child in self.subtopicos],
        }


def eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            lines.append("")
            continue
        # Junta quebras triviais e hifenização de fim de linha.
        line = re.sub(r"(?<=\w)-\s+(?=\w)", "", line)
        line = re.sub(r"\s{2,}", " ", line)
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def read_pdf_text(pdf_path: Path) -> str:
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo PDF nao encontrado: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(f"Entrada nao parece ser PDF: {pdf_path}")

    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:  # pragma: no cover - leitura resiliente
            eprint(f"[aviso] Falha ao ler pagina {index}: {exc}")
            text = ""
        text = normalize_text(text)
        if text:
            pages.append(f"[Pagina {index}]\n{text}")

    full_text = normalize_text("\n\n".join(pages))
    if not full_text:
        raise ValueError("PDF vazio ou sem texto extraivel.")
    return full_text


def split_into_chunks(text: str, target: int = CHUNK_TARGET, hard_limit: int = CHUNK_MAX) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current, current_len
        if current:
            chunks.append("\n\n".join(current).strip())
            current = []
            current_len = 0

    for paragraph in paragraphs:
        paragraph = normalize_text(paragraph)
        if not paragraph:
            continue
        paragraph_len = len(paragraph)

        if paragraph_len > hard_limit:
            flush()
            chunks.extend(split_long_paragraph(paragraph, target))
            continue

        if current and current_len + paragraph_len + 2 > target:
            flush()

        current.append(paragraph)
        current_len += paragraph_len + 2

    flush()

    merged: list[str] = []
    for chunk in chunks:
        if merged and len(chunk) < int(target * 0.35):
            candidate = merged[-1] + "\n\n" + chunk
            if len(candidate) <= hard_limit:
                merged[-1] = candidate
                continue
        merged.append(chunk)
    return merged


def split_long_paragraph(paragraph: str, target: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9(])", paragraph)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and current_len + len(sentence) + 1 > target:
            chunks.append(" ".join(current).strip())
            current = []
            current_len = 0
        current.append(sentence)
        current_len += len(sentence) + 1
    if current:
        chunks.append(" ".join(current).strip())
    return chunks


def choose_model(text_length: int) -> str:
    return BIG_MODEL if text_length >= BIG_TEXT_THRESHOLD else MIN_MODEL


def normalize_key(value: str) -> str:
    value = value.lower().strip()
    value = unicodedata_normalize(value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def unicodedata_normalize(value: str) -> str:
    try:
        import unicodedata

        return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    except Exception:
        return value


def build_chunk_prompt(chunk_text: str, chunk_index: int, total_chunks: int, source_title: str) -> str:
    template = Template("""
Voce e um especialista em mapas mentais medicos, DSM e preparo para prova.

Tarefa:
- Ler o trecho abaixo de um PDF de estudo.
- Produzir um mapa mental denso em portugues.
- Nao resumir demais.
- Manter alta densidade informativa.
- Estrutura profunda com minimo de 4 niveis, quando o texto permitir.
- Incluir obrigatoriamente: conceito, fisiopatologia, clinica, diagnostico e tratamento.
- Priorizar termos medicos, detalhes clinicos, criterios e relacoes de prova.
- O mapa deve ser coerente com os outros chunks e nao pode perder contexto.

Formato de saida obrigatorio:
{{
  "titulo": "TEMA",
  "topicos": [
    {{
      "nome": "topico",
      "subtopicos": [
        {{
          "nome": "subtopico",
          "subtopicos": [
            {{
              "nome": "detalhe",
              "subtopicos": []
            }}
          ]
        }}
      ]
    }}
  ]
}}

Regras de qualidade:
- Use linguagem tecnica em portugues.
- Expanda o conteudo de forma densa.
- Evite itens vazios, genéricos ou repetitivos.
- Agrupe por conceito, fisiopatologia, clinica, diagnostico e tratamento.
- Mantenha hierarquia logica.
- Se houver lista, converta em subtopicos profundos.
- Nao inclua markdown, explicacoes, crases nem texto fora do JSON.

Contexto do documento:
- Titulo sugerido: $source_title
- Chunk atual: $chunk_index/$total_chunks

Trecho do PDF:
\"\"\"$chunk_text\"\"\"
""")
    return template.substitute(
        source_title=source_title,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
        chunk_text=chunk_text,
    )


def build_merge_prompt(partials: list[dict[str, Any]], source_title: str) -> str:
    serialized = json.dumps(partials, ensure_ascii=False, indent=2)
    template = Template("""
Voce vai unificar varios mapas mentais parciais extraidos do mesmo PDF.

Objetivo:
- Consolidar em um unico mapa final em portugues.
- Remover duplicacoes e redundancias.
- Preservar a hierarquia logica e a densidade.
- Manter foco medico / DSM / prova.
- Garantir profundidade minima de 4 niveis quando o material permitir.
- Incluir obrigatoriamente: conceito, fisiopatologia, clinica, diagnostico e tratamento.

Formato de saida obrigatorio:
{{
  "titulo": "TEMA",
  "topicos": [
    {{
      "nome": "topico",
      "subtopicos": [
        {{
          "nome": "subtopico",
          "subtopicos": [
            {{
              "nome": "detalhe",
              "subtopicos": []
            }}
          ]
        }}
      ]
    }}
  ]
}}

Regras:
- Nao resuma demais.
- Nao use markdown.
- Nao explique o processo.
- Nao repita blocos iguais.
- Reorganize de forma natural e coerente.
- Use o titulo sugerido como base, se fizer sentido: {source_title}

Mapas parciais:
${serialized}
""")
    return template.substitute(source_title=source_title, serialized=serialized)


def extract_json_text(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)

    first = raw.find("{")
    last = raw.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidate = raw[first:last + 1]
        return candidate.strip()
    return raw


def safe_json_loads(raw: str) -> Any:
    candidate = extract_json_text(raw)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Tentativa bruta de remover lixo no final/inicio.
        candidate = re.sub(r"^[^{]*", "", candidate, count=1, flags=re.DOTALL)
        candidate = re.sub(r"[^}]*$", "", candidate, count=1, flags=re.DOTALL)
        return json.loads(candidate)


def openai_client() -> OpenAI:
    if not os.getenv("OPENAI_API_KEY"):
        raise EnvironmentError("OPENAI_API_KEY nao encontrada no ambiente.")
    return OpenAI()


def extract_output_text(response: Any) -> str:
    if hasattr(response, "output_text") and response.output_text:
        return str(response.output_text)
    if hasattr(response, "output") and response.output:
        parts: list[str] = []
        for item in response.output:
            content = getattr(item, "content", None)
            if not content:
                continue
            for chunk in content:
                text = getattr(chunk, "text", None)
                if text:
                    parts.append(text)
        return "\n".join(parts)
    return str(response)


def call_openai_json(client: OpenAI, model: str, prompt: str) -> dict[str, Any]:
    try:
        response = client.responses.create(
            model=model,
            input=prompt,
            temperature=0.35,
        )
    except Exception as exc:
        message = str(exc)
        if "Missing scopes" in message or "insufficient permissions" in message:
            raise PermissionError(
                "A chave configurada nao possui permissao de escrita em responses. "
                "Use uma chave com escopo adequado (responses.write)."
            ) from exc
        raise
    raw_text = extract_output_text(response)
    if not raw_text.strip():
        raise RuntimeError("A API nao retornou texto.")
    data = safe_json_loads(raw_text)
    if not isinstance(data, dict):
        raise ValueError("Resposta da API nao veio como objeto JSON.")
    return data


def normalize_topic_tree(data: Any, fallback_title: str) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Estrutura JSON invalida.")

    titulo = str(data.get("titulo") or fallback_title or "Mapa Mental").strip()
    topicos = data.get("topicos") or []
    if not isinstance(topicos, list):
        topicos = []

    def normalize_node(node: Any) -> MindMapNode:
        if isinstance(node, str):
            return MindMapNode(nome=node.strip(), subtopicos=[])
        if not isinstance(node, dict):
            return MindMapNode(nome="Item", subtopicos=[])
        nome = str(node.get("nome") or node.get("titulo") or node.get("text") or "").strip()
        if not nome:
            nome = "Item"
        children = node.get("subtopicos") or node.get("children") or []
        if not isinstance(children, list):
            children = []
        child_nodes = [normalize_node(child) for child in children]
        return MindMapNode(nome=nome, subtopicos=child_nodes).dedupe()

    normalized = [normalize_node(node) for node in topicos]
    root = MindMapNode(nome=titulo, subtopicos=normalized).dedupe()
    return root.to_dict()


def merge_partial_trees(partials: list[dict[str, Any]], source_title: str) -> dict[str, Any]:
    root_name = source_title.strip() or "Mapa Mental"
    root = MindMapNode(nome=root_name, subtopicos=[])
    bucket: dict[str, MindMapNode] = {}

    def get_or_create(name: str) -> MindMapNode:
        key = normalize_key(name)
        if key not in bucket:
            bucket[key] = MindMapNode(nome=name, subtopicos=[])
            root.subtopicos.append(bucket[key])
        return bucket[key]

    for partial in partials:
        normalized = normalize_topic_tree(partial, root_name)
        for topic in normalized.get("subtopicos", []):
            if not isinstance(topic, dict):
                continue
            topic_name = str(topic.get("nome") or "Item")
            topic_node = get_or_create(topic_name)
            for sub in topic.get("subtopicos", []):
                append_deep(topic_node, sub)

    return root.dedupe().to_dict()


def append_deep(parent: MindMapNode, node_data: Any) -> None:
    if isinstance(node_data, str):
        child = MindMapNode(nome=node_data.strip(), subtopicos=[])
        if normalize_key(child.nome) not in {normalize_key(c.nome) for c in parent.subtopicos}:
            parent.subtopicos.append(child)
        return
    if not isinstance(node_data, dict):
        return
    name = str(node_data.get("nome") or "Item").strip() or "Item"
    existing = next((c for c in parent.subtopicos if normalize_key(c.nome) == normalize_key(name)), None)
    if existing is None:
        existing = MindMapNode(nome=name, subtopicos=[])
        parent.subtopicos.append(existing)
    children = node_data.get("subtopicos") or []
    if isinstance(children, list):
        for child in children:
            append_deep(existing, child)


def tree_to_text(node: dict[str, Any], indent: int = 0) -> str:
    prefix = " " * indent
    lines = [f"{prefix}{node.get('titulo') or node.get('nome') or 'Mapa Mental'}"]
    for topic in node.get("topicos", node.get("subtopicos", [])):
        lines.extend(tree_branch_to_text(topic, indent + 1))
    return "\n".join(lines)


def tree_branch_to_text(node: Any, indent: int = 0) -> list[str]:
    prefix = " " * indent + "├── "
    if isinstance(node, str):
        return [f"{prefix}{node}"]
    if not isinstance(node, dict):
        return [f"{prefix}Item"]
    name = str(node.get("nome") or node.get("titulo") or "Item")
    lines = [f"{prefix}{name}"]
    children = node.get("subtopicos") or node.get("children") or []
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict) and child.get("subtopicos"):
                lines.extend(tree_branch_to_text(child, indent + 1))
            else:
                child_name = str(child.get("nome") if isinstance(child, dict) else child)
                lines.append(" " * (indent + 1) + f"│   ├── {child_name}")
    return lines


def export_outputs(result: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    txt_path = output_dir / f"{DEFAULT_OUTPUT_BASENAME}.txt"
    json_path = output_dir / f"{DEFAULT_OUTPUT_BASENAME}.json"
    txt_path.write_text(tree_to_text(result), encoding="utf-8")
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return txt_path, json_path


def detect_default_pdf() -> Optional[Path]:
    candidates = sorted(Path.cwd().glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidates:
        return candidates[0]
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Converte PDF em mapa mental denso.")
    parser.add_argument("pdf", nargs="?", help="Caminho do PDF de entrada.")
    parser.add_argument("--output-dir", default=None, help="Diretorio de saida. Padrao: pasta do PDF.")
    parser.add_argument("--title", default=None, help="Titulo base opcional para o mapa.")
    parser.add_argument("--dry-run", action="store_true", help="Nao chama a OpenAI; apenas extrai e divide.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_path = Path(args.pdf).expanduser().resolve() if args.pdf else detect_default_pdf()
    if pdf_path is None:
        print("Nenhum PDF informado e nenhum PDF padrao (*.pdf) encontrado no diretório atual.", file=sys.stderr)
        return 1

    print(f"[1/6] Lendo PDF: {pdf_path}")
    try:
        text = read_pdf_text(pdf_path)
    except Exception as exc:
        print(f"Erro ao ler PDF: {exc}", file=sys.stderr)
        return 2

    print(f"[2/6] Texto extraido: {len(text):,} caracteres")
    chunks = split_into_chunks(text)
    if not chunks:
        print("PDF sem texto util para processar.", file=sys.stderr)
        return 3
    print(f"[3/6] Chunks gerados: {len(chunks)}")

    source_title = args.title or pdf_path.stem
    if args.dry_run:
        print("[modo dry-run] Nenhuma chamada OpenAI sera feita.")
        return 0

    try:
        client = openai_client()
    except Exception as exc:
        print(f"Erro de configuracao OpenAI: {exc}", file=sys.stderr)
        return 4

    partial_maps: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunks, start=1):
        model = choose_model(len(chunk))
        print(f"[4/6] Processando chunk {index}/{len(chunks)} com {model} ({len(chunk):,} caracteres)")
        prompt = build_chunk_prompt(chunk, index, len(chunks), source_title)
        try:
            chunk_map = call_openai_json(client, model, prompt)
            partial_maps.append(normalize_topic_tree(chunk_map, source_title))
        except Exception as exc:
            print(f"Erro no chunk {index}: {exc}", file=sys.stderr)
            return 5

    print("[5/6] Unificando mapas parciais...")
    merge_model = BIG_MODEL if len(text) >= BIG_TEXT_THRESHOLD else MIN_MODEL
    try:
        merge_prompt = build_merge_prompt(partial_maps, source_title)
        merged = call_openai_json(client, merge_model, merge_prompt)
        final_map = normalize_topic_tree(merged, source_title)
    except Exception as exc:
        print(f"[aviso] Falha na unificacao via IA: {exc}. Usando merge local.", file=sys.stderr)
        final_map = merge_partial_trees(partial_maps, source_title)

    final_map = normalize_topic_tree(final_map, source_title)
    output_dir = Path(args.output_dir).expanduser().resolve() if args.output_dir else pdf_path.parent
    txt_path, json_path = export_outputs(final_map, output_dir)

    print("[6/6] Salvando arquivos...")
    print(f"TXT: {txt_path}")
    print(f"JSON: {json_path}")
    print("Mapa mental concluido com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
