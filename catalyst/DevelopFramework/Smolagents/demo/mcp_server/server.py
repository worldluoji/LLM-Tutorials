import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server.fastmcp import FastMCP

from tools.read_csv_tool import ReadCSVTool
from tools.write_md_tool import WriteMDTool

mcp = FastMCP(
    name="csv-analysis-server",
    host="0.0.0.0",
    port=38000,
)

_TOOLS = {
    "read_csv": ReadCSVTool(),
    "write_md": WriteMDTool(),
}


@mcp.tool()
def read_csv(file_path: str, max_rows: int | None = None) -> str:
    """Reads a CSV file and returns its contents as a markdown-formatted string.

    Use this tool to load data from a CSV file before analyzing it.
    If the file has more rows than `max_rows`, only the first `max_rows` rows are returned
    and a truncation notice is appended.

    Args:
        file_path: The absolute or relative path to the CSV file to read.
        max_rows: Maximum number of data rows to return. Defaults to 100, set to 0 to read all rows.

    Returns:
        The CSV content formatted as a markdown string.
    """
    return _TOOLS["read_csv"].forward(file_path=file_path, max_rows=max_rows)


@mcp.tool()
def write_md(file_path: str, content: str) -> str:
    """Writes a Markdown report to a file on disk.

    Use this tool to persist the final analysis report.
    The `content` argument is the full Markdown text (titles, bullet points, tables, etc.).

    Args:
        file_path: The absolute or relative path of the Markdown file to write. Parent directories will be created if missing.
        content: The full Markdown content to write to the file.

    Returns:
        The absolute path of the written file.
    """
    return _TOOLS["write_md"].forward(file_path=file_path, content=content)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
