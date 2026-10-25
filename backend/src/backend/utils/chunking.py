# chunking/markdown_chunker.py
import re
from dataclasses import dataclass, field
from typing import Any

import tiktoken
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

_HEADING_KEYS = ("h1", "h2", "h3", "h4")

_encoding = tiktoken.get_encoding("cl100k_base")

DEFAULT_ROWS_PER_CHUNK = 10
MAX_CHUNK_TOKENS = 450

_SHEET_RE = re.compile(r"^## Sheet: (.*)$")

_header_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3"), ("####", "h4")],
    strip_headers=True,  # heading goes to metadata, not the body
)

_recursive = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",
    chunk_size=450,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", " ", ""],
)


@dataclass
class Chunk:
    index: int
    text: str  # markdown body, for display and LLM context
    embed_text: str  # heading path + body, sent to the embedder
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def heading_path(self) -> str:
        return " > ".join(self.metadata[k] for k in _HEADING_KEYS if k in self.metadata)


def chunk_document(
    normalized: str,
    filename: str,
) -> list[Chunk]:
    extension = filename.rsplit(".", 1)[-1].lower()
    metadata = {"filename": filename}

    if extension in {"csv", "xlsx"}:
        return chunk_tabular(normalized, metadata)

    return chunk_markdown(normalized, metadata)


def _promote_title(md: str) -> str:
    """Word 'Title' style and plain first lines come through without '#'."""
    lines = md.lstrip().split("\n", 2)
    if (
        lines
        and lines[0]
        and not lines[0].startswith("#")
        and len(lines[0]) <= 120
        and (len(lines) < 2 or lines[1] == "")
    ):
        return "# " + md.lstrip()
    return md


def chunk_markdown(md: str, base_metadata: dict[str, Any] | None = None) -> list[Chunk]:
    base = base_metadata or {}
    sections = _header_splitter.split_text(_promote_title(md))
    pieces = _recursive.split_documents(sections)  # keeps each section's metadata

    chunks: list[Chunk] = []
    for d in pieces:
        body = d.page_content.strip()
        if not body:
            continue
        meta = {**base, **d.metadata}  # headings override on key clash
        chunk = Chunk(index=len(chunks), text=body, embed_text=body, metadata=meta)
        if chunk.heading_path:
            chunk.embed_text = f"{chunk.heading_path}\n\n{body}"
        chunk.metadata["chunk_index"] = chunk.index
        chunks.append(chunk)
    return chunks


def chunk_tabular(
    text: str,
    base_metadata: dict[str, Any] | None = None,
    rows_per_chunk: int = DEFAULT_ROWS_PER_CHUNK,
    max_tokens: int = MAX_CHUNK_TOKENS,
) -> list[Chunk]:
    base = base_metadata or {}

    chunks: list[Chunk] = []
    sheet_name: str | None = None
    rows: list[str] = []

    def flush() -> None:
        if not rows:
            return

        body = "\n".join(rows)
        metadata = dict(base)

        if sheet_name is not None:
            metadata["sheet_name"] = sheet_name

        metadata["chunk_index"] = len(chunks)
        metadata["row_count"] = len(rows)

        # Include sheet context in every XLSX chunk.
        embed_text = (
            f"Sheet: {sheet_name}\n\n{body}" if sheet_name is not None else body
        )

        chunks.append(
            Chunk(
                index=len(chunks),
                text=body,
                embed_text=embed_text,
                metadata=metadata,
            )
        )
        rows.clear()

    for line in text.splitlines():
        line = line.strip()

        if not line:
            continue

        match = _SHEET_RE.match(line)
        if match:
            flush()
            sheet_name = match.group(1).strip()
            continue

        candidate = "\n".join([*rows, line])
        candidate_text = (
            f"Sheet: {sheet_name}\n\n{candidate}"
            if sheet_name is not None
            else candidate
        )
        token_count = len(_encoding.encode(candidate_text))

        if rows and (len(rows) >= rows_per_chunk or token_count > max_tokens):
            flush()

        rows.append(line)

    flush()
    return chunks
