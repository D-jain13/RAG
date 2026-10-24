from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from backend.models.chunk import Chunk
from backend.models.document import Document
from backend.models.lsh_band import LshBand
from backend.models.tenant import Tenant
