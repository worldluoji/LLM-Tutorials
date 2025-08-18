install
```shell
uv pip install -e .
```
从当前目录安装依赖（推荐）, 会自动读取 pyproject.toml 中的依赖。

手动创建.env文件，添加你的deepseek api key
```
deepseek=<your_key>
```

运行：
```shell
uv run jobsearch-mcp-server
```

```
uv run mcp dev
```