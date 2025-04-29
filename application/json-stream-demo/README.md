# JSON stream demo
安装依赖：
```
npm install
```
运行：
```
npm run dev
```
当我们点击提交时，上面的输出框（{{ content }}）给出的是原始数据，它是不完整的 JSON 数据，我们不能立即使用它。

而下面的输入框（{{ contentParsed }}），始终是保持着完整的 JSON 格式，我们随时可以处理它，用它来更新 UI。
