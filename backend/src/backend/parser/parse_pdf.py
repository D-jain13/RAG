from typing import BinaryIO

import pymupdf
import pymupdf4llm

from backend.core.config import get_settings
from backend.parser.parsing_errors import EmptyDocument, ParseError

setting = get_settings()


def parse_pdf(f: BinaryIO):
    try:
        doc = pymupdf.open(stream=f.read(), filetype="pdf")
    except Exception as e:
        raise ParseError(f"Cannot open pdf : {e}") from e

    try:
        if doc.needs_pass:
            raise ParseError("Pdf is password protected")
        if doc.page_count > setting.pdf_max_pages:
            raise ParseError(f"Pdf has too many pages : {doc.page_count}")

        text = pymupdf4llm.to_markdown(doc, ignore_images=True, show_progress=False)
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(f"cannot read pdf: {e}") from e
    finally:
        doc.close()

    if not text.strip():
        raise EmptyDocument("pdf has no text layer (scanned? needs OCR)")
    return text.strip()
