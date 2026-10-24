import re
import unicodedata


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)

    # Normalize line endings.
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove unwanted control characters while preserving newlines
    # and tabs.
    text = "".join(
        ch
        for ch in text
        if ch in "\n\t" or not unicodedata.category(ch).startswith("C")
    )

    # Normalize whitespace within each line.
    lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in text.split("\n")]

    # Collapse repeated blank lines, not meaningful row boundaries.
    result = "\n".join(lines)
    result = re.sub(r"\n{3,}", "\n\n", result)

    return result.strip()
