import codecs
from typing import BinaryIO

from charset_normalizer import from_bytes

from backend.parser.parsing_errors import EmptyDocument


def decode_text(raw: bytes) -> str:
    if raw.startswith(codecs.BOM_UTF8):
        return raw.decode("utf-8-sig")
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return raw.decode("utf-16")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        best = from_bytes(raw).best()
        return str(best) if best else raw.decode("cp1252", errors="replace")


def parse_text(f: BinaryIO) -> str:
    text = decode_text(f.read())
    if not text.strip():
        raise EmptyDocument("file has no text")
    return text
