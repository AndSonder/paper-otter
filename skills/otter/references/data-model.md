# 本地数据格式

所有文件位于 `.paper-daily/`，均为用户私有数据。

## profile.json

```json
{
  "version": 1,
  "reader": {"language": "zh-CN", "background": [], "tools": []},
  "goals": [{"question": "", "priority": 1, "horizon": "3 months"}],
  "topics": {"strong": [], "learning": [], "avoid": []},
  "reading": {"dailyMinutes": 30, "daysPerWeek": 5},
  "recommendation": {"primaryCount": 1, "alternativeCount": 2, "explorationRate": 0.2, "recency": "balanced"},
  "preferences": {"positiveExamples": [], "negativeExamples": [], "dropReasons": []}
}
```

画像不保存固定的“阅读产出类型”。每次推荐根据当天目标和论文类型决定应突出推导、实现、实验判断、领域关系或实践启发；用户当次提出的要求优先。

冷启动时，`positiveExamples` 保存用户从种子候选中主动点选的论文 ID，`negativeExamples` 只保存用户明确选择“不会打开”的论文 ID。没有选中的卡片不自动记为负反馈。由选择推断出的主题和目标先写入 `inferences.json`，不要为了填满字段伪造确定偏好。`reading.dailyMinutes` 初始使用 30；当天选择的阅读预算属于会话条件，不立即覆盖该值。

## papers/<paper-id>/paper.json

必须包含 `id`、`title`、`englishTitle`、`year`、`tags`、`minutes`、`reason` 和 `source`。可包含 `terms`、`outline`。同目录 `article.md` 是可选中文精读稿，`assets/` 保存本地图片。

没有通过完整写作门禁时，`paper.json` 只存在于私有推荐状态，不会出现在网站 catalog。网站不发布 metadata-only 论文、空正文或占位文章。

私有正文中的本地图片使用相对路径 `assets/<文件名>`；`paperctl.py sync` 会复制 `assets/`，并把正文路径改写为网站使用的 `/local/papers/<paper-id>/<文件名>`。不要在私有正文中手写发布路径。

完整精读稿还包含 `writing-workflow.json` 与 `writing.json`。它们只能由 `paperctl.py writing-begin` 和按顺序执行的 `writing-record` 生成。前者保存 evidence、逻辑稿、独立逻辑审查、送读稿、独立读者报告、修订记录与最终稿的哈希链；后者是完成清单。手写、跳步、提前创建最终稿或登记后修改任一阶段文件都会导致发布失败。

## candidates/YYYY-MM-DD.json

保存检索意图、候选证据卡、发表或报告状态、来源核验、学习价值准入判断、逐维排序、淘汰原因、最终顺序和模型不确定性。字段示例见 [来源与学习价值门槛](source-quality.md)。不要只保存总分，也不要用顶会或机构名称替代内容判断。

## events.jsonl

一行一个事件：UTC 时间、paperId、类型和值。网站的 D1 阅读记录可以导出后合并到这里；重复事件按稳定 session 或时间戳去重。

导入网站导出的记录：

```sh
python3 scripts/paperctl.py import-history <reading-export.json>
```

## inferences.json

保存大模型从行为中推断的临时偏好。每条包含 `claim`、`scope`、`confidence`、`evidenceEvents`、`createdAt` 和 `reviewAfter`。它与用户明确填写的 profile 分开；发生冲突时 profile 优先。
