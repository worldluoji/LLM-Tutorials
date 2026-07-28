import csv

from smolagents import Tool


class ReadCSVTool(Tool):
    name = "read_csv"
    description = (
        "Reads a CSV file and returns its contents as a markdown-formatted string. "
        "Use this tool to load data from a CSV file before analyzing it. "
        "If the file has more rows than `max_rows`, only the first `max_rows` rows are returned "
        "and a truncation notice is appended."
    )
    inputs = {
        "file_path": {
            "type": "string",
            "description": "The absolute or relative path to the CSV file to read.",
        },
        "max_rows": {
            "type": "integer",
            "description": "Maximum number of data rows to return. Defaults to 100, set to 0 to read all rows.",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, default_max_rows: int = 100, encoding: str = "utf-8"):
        super().__init__()
        self.default_max_rows = default_max_rows
        self.encoding = encoding

    def forward(self, file_path: str, max_rows: int | None = None) -> str:
        limit = self.default_max_rows if max_rows is None else max_rows
        with open(file_path, "r", encoding=self.encoding, newline="") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if not rows:
            return f"(empty file: {file_path})"

        header, data = rows[0], rows[1:]
        truncated = False
        if limit and limit > 0 and len(data) > limit:
            data = data[:limit]
            truncated = True

        lines = [", ".join(header)]
        lines.extend(", ".join(row) for row in data)
        result = "\n".join(lines)

        if truncated:
            result += f"\n\n... (truncated, {len(rows) - 1 - limit} more rows not shown)"

        return result
