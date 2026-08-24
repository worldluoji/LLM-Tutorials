# /commit - 自动提交代码

AI 分析已暂存的变更，使用 Conventional Commits 规范生成提交信息。

## 执行流程

1. **检查暂存区**：运行 `git status` 查看已暂存的文件
2. **分析变更**：运行 `git diff --cached` 查看暂存的具体变更
3. **确定类型**：根据变更内容判断提交类型
   - 新功能/模块 → `feat`
   - Bug 修复 → `fix`
   - 文档/注释 → `docs`
   - 代码格式/风格 → `style`
   - 重构/优化 → `refactor`
   - 测试文件 → `test`
   - 构建/工具/配置 → `chore`
4. **确定范围**：根据变更文件所在目录确定 scope
5. **生成描述**：一句话简洁描述核心变更
6. **执行提交**：仅提交已暂存的文件（**不自动暂存未跟踪的文件**）

## 关键规则

- **/commit** - 只提交暂存区的内容，不会自动暂存任何新文件
- **/commit --all** - 先执行 `git add -A` 暂存所有，再提交

## 提交类型定义

```
feat:     新功能
fix:      Bug 修复
docs:     文档更新
style:    代码格式（不影响功能）
refactor: 重构（不影响功能）
test:     测试相关
chore:    构建/工具相关
```

## 输出格式

必须遵循 Conventional Commits：`type(scope): description`

- type: 小写
- scope: 可选，括号包围
- description: 动词开头，不超过 50 字符

## 示例

**场景1: 部分文件已暂存，执行 /commit**
```
已暂存: src/tools/bash.ts, test/tools/test.bash.ts

AI 分析后生成:
feat(tools): 实现 bash 命令执行工具

- BashTool 支持链式命令和 30s 超时保护
- 添加表格驱动测试用例
```

**场景2: 需要提交所有更改，执行 /commit --all**
```
全部变更已暂存，AI 分析后生成:
feat(engine): 实现 Two-Stage ReAct 慢思考模式

- Phase 1 思考阶段，剥夺工具强制规划
- Phase 2 行动阶段，恢复工具执行
```

## 注意事项

- 执行前必须先运行 `git status` 确认暂存区内容
- 只对暂存的文件进行 commit，不自动 add 新文件
- 描述禁止使用 "更新" "修改" 等模糊词汇
- 如果暂存区为空，提示用户先手动 `git add` 或使用 `/commit --all`