
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )

from procrastinate import App, PsycopgConnector
from backend.core.config import get_settings

app = App(
    connector=PsycopgConnector(
        conninfo=get_settings().procrastinate_dsn
    ),
    import_paths=["backend.worker.tasks"],
)
