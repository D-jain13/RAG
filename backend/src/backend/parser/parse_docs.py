import io
from typing import BinaryIO

from markitdown import MarkItDown, StreamInfo

from .parsing_errors import EmptyDocument, ParseError

_md = MarkItDown(enable_plugins=False)


def parse_docs(f: BinaryIO) -> str:

    try:
        f.seek(0)
        buf = io.BytesIO(f.read())
        result = _md.convert_stream(buf, stream_info=StreamInfo(extension=".docx"))
    except Exception as e:
        raise ParseError(f"cannot open docx: {e}") from e

    text = (result.text_content or "").strip()

    if not text:
        raise EmptyDocument("docx has no text")
    return text
