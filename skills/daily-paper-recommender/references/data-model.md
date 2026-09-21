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

## papers/<paper-id>/paper.json

必须包含 `id`、`title`、`englishTitle`、`year`、`tags`、`minutes`、`reason` 和 `source`。可包含 `terms`、`outline`。同目录 `article.md` 是可选中文精读稿，`assets/` 保存本地图片。

正文中的本地图片使用 `/local/papers/<paper-id>/<文件名>`；`paperctl.py sync` 会把 `assets/` 同步到对应路径。

## candidates/YYYY-MM-DD.json

保存检索意图、候选证据卡、逐维判断、淘汰原因、最终顺序和模型不确定性。不要只保存总分。

## events.jsonl

一行一个事件：UTC 时间、paperId、类型和值。网站的 D1 阅读记录可以导出后合并到这里；重复事件按稳定 session 或时间戳去重。

导入网站导出的记录：

```sh
python3 scripts/paperctl.py import-history <reading-export.json>
```

## inferences.json

保存大模型从行为中推断的临时偏好。每条包含 `claim`、`scope`、`confidence`、`evidenceEvents`、`createdAt` 和 `reviewAfter`。它与用户明确填写的 profile 分开；发生冲突时 profile 优先。
