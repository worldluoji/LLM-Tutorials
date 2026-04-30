# /commit - 自动提交代码

AI 分析变更后自动生成提交信息，使用 Conventional Commits 规范。

## 执行流程

1. **分析变更**：运行 `git diff --cached`（已暂存）或 `git diff HEAD`（所有更改）
2. **确定类型**：根据变更内容判断提交类型
   - 新功能/模块 → `feat`
   - Bug 修复 → `fix`
   - 文档/注释 → `docs`
   - 代码格式/风格 → `style`
   - 重构/优化 → `refactor`
   - 测试文件 → `test`
   - 构建/工具/配置 → `chore`
3. **确定范围**：根据变更文件所在目录确定 scope
4. **生成描述**：一句话简洁描述核心变更
5. **执行提交**：
   - 默认提交已暂存的文件
   - 使用 `--all` 暂存所有更改后提交

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

**分析后 AI 自动生成：**
```
feat(engine): 实现 Two-Stage ReAct 慢思考模式

- 新增 Phase 1 思考阶段，剥夺工具强制规划
- 新增 Phase 2 行动阶段，恢复工具执行
- 支持 enableThinking 参数开关
```

## 注意事项

- 必须先运行 `git status` 查看变更文件
- 暂存文件后运行 `git commit -m "..."` 执行提交
- 禁止在描述中包含 "更新" "修改" 等模糊词汇
- 如果没有变更则不执行提交