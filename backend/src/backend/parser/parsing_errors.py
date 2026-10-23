class ParseError(Exception):
    """Permanent failure: retrying the same bytes will not help."""


class UnsupportedFileType(ParseError): ...


class EmptyDocument(ParseError): ...
