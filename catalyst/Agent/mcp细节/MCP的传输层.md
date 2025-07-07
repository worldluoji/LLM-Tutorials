# MCP的传输层

![MCP的传输层](./assets/MCP传输层架构图.png)

所有传输都遵循 JSON-RPC 2.0 格式，无论选哪一种，Host 启动时都会分别构造 ClientSession 和 ServerSession，将它们的读写流对接到相应的底层通道——本地时可把一端的 stdout 连到另一端的 stdin，远程时则通过 HTTP 或 WS 长连接互联。

![各传输方式的应用场景](./assets/各传输方式的应用场景.png)