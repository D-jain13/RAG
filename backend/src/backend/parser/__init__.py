import asyncio
from pathlib import Path
from typing import BinaryIO

from backend.parser.parse_csv import parse_csv
from backend.parser.parse_docs import parse_docs
from backend.parser.parse_pdf import parse_pdf
from backend.parser.parse_text import parse_text
from backend.parser.parse_xlsx import parse_xlsx
from backend.parser.parsing_errors import UnsupportedFileType

PARSERS = {
    ".pdf": parse_pdf,
    ".docx": parse_docs,
    ".xlsx": parse_xlsx,
    ".csv": parse_csv,
    ".txt": parse_text,
    ".md": parse_text,
    ".markdown": parse_text,
}


def parse_file(f: BinaryIO, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    parser = PARSERS.get(ext)
    if parser is None:
        raise UnsupportedFileType(f"unsupported file type: {ext or filename}")
    return parser(f)


async def parse_file_async(f: BinaryIO, filename: str) -> str:
    return await asyncio.to_thread(parse_file, f, filename)
