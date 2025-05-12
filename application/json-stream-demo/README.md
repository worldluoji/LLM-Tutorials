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

---

## 引入和JSON Parser模块是如何实现的？
https://github.com/WeHomeBot/ling/blob/main/src/parser/index.ts

JSONParser 本质上仍然是一个标准的 JSON 语言解析器。解析器（Parser）的作用是把一串字符串（在这里是 JSON 代码）转化为可被程序使用的数据对象。

上面的 JSON 解析器实现，整体就是一个手写的基于状态机词法解析（lexer）加上带栈自动机的手写 JSON 解析器，它通过一个大分发函数 trace(input: string)，按照当前状态分类处理输入字符，最终解析完成后触发相应的事件。