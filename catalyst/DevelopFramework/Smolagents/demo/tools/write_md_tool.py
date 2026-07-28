import os

from smolagents import Tool


class WriteMDTool(Tool):
    name = "write_md"
    description = (
        "Writes a Markdown report to a file on disk. "
        "Use this tool to persist the final analysis report from the agent. "
        "The `content` argument is the full Markdown text (titles, bullet points, tables, etc.). "
        "Returns the absolute path of the written file."
    )
    inputs = {
        "file_path": {
            "type": "string",
            "description": "The absolute or relative path of the Markdown file to write. Parent directories will be created if missing.",
        },
        "content": {
            "type": "string",
            "description": "The full Markdown content to write to the file.",
        },
    }
    output_type = "string"

    def __init__(self, encoding: str = "utf-8"):
        super().__init__()
        self.encoding = encoding

    def forward(self, file_path: str, content: str) -> str:
        if not content:
            raise ValueError("Refusing to write empty Markdown content.")

        parent = os.path.dirname(os.path.abspath(file_path))
        if parent:
            os.makedirs(parent, exist_ok=True)

        with open(file_path, "w", encoding=self.encoding) as f:
            f.write(content)

        return os.path.abspath(file_path)
