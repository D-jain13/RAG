# chunking/markdown_chunker.py
from dataclasses import dataclass, field
from typing import Any

from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

_HEADING_KEYS = ("h1", "h2", "h3", "h4")

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
