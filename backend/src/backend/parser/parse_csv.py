import csv
import io
from typing import BinaryIO

from backend.parser.parse_text import decode_text
from backend.parser.parsing_errors import EmptyDocument, ParseError

csv.field_size_limit(10_000_000)


def parse_csv(f: BinaryIO) -> str:
    text = decode_text(f.read())

    try:
        dialect = csv.Sniffer().sniff(
            text[:65536],
            delimiters=",;\t|",
        )
    except csv.Error:
        dialect = csv.excel

    lines = []

    try:
        reader = csv.reader(io.StringIO(text, newline=""), dialect)
        header = None

        for row in reader:
            cells = [c.strip() for c in row]

            # Ignore completely empty rows.
            if not any(cells):
                continue

            # Use the first non-empty row as the header.
            if header is None:
                while cells and not cells[-1]:
                    cells.pop()

                header = []
                used_headers = set()

                for i, name in enumerate(cells, start=1):
                    name = name or f"Column_{i}"
                    original_name = name
                    suffix = 2

                    while name in used_headers:
                        name = f"{original_name}_{suffix}"
                        suffix += 1

                    header.append(name)
                    used_headers.add(name)

                continue

            # Preserve extra cells instead of truncating them.
            if len(cells) > len(header):
                for i in range(len(header) + 1, len(cells) + 1):
                    header.append(f"Column_{i}")

            # Pad shorter rows to match the header length.
            cells += [""] * (len(header) - len(cells))

            fields = [
                f"{name}: {value}"
                for name, value in zip(header, cells)
                if name and value
            ]

            if fields:
                lines.append(" | ".join(fields))

    except csv.Error as e:
        raise ParseError(f"invalid csv: {e}") from e

    if not lines:
        raise EmptyDocument("csv has no data")

    return "\n".join(lines)
