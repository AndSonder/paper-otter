---
name: otter
description: 初始化并运行一个由大模型驱动的个性化论文阅读系统。用于建立本地读者画像、每天检索和推荐论文、生成单篇中文精读或多来源中文调研、根据阅读反馈更新偏好，以及把成品同步到阅读网站。
---

# Paper Otter：个性化论文阅读系统

服务一个具体读者，而不是维护公共文章库。用户画像、候选、文章和行为记录都保存在仓库的 `.paper-daily/`，不得提交到公共仓库。

## 命令入口

只接受四个动作；缺少动作时，先让用户从具体动作中选择，不猜测：

- `$otter init`：从零初始化画像并生成首批候选。
- `$otter recommend`：读取现有画像和反馈，推荐今天的论文。这个动作只能生成候选审计、daily 选择和 `paper.json`，不能生成正文。
- `$otter write <paper-id 或论文链接>`：为指定论文生成中文精读稿。必须从有序写作状态机开始，不能把已经写好的摘要、速读稿或聊天回答补齐文件后冒充完整流程。
- `$otter research <问题>`：围绕一个明确问题生成多来源中文调研报告。必须先定义范围和截至日期，再完成来源审计、证据矩阵、综合写作与独立审查；禁止把逐篇摘要拼成调研。

只暴露 `$otter`，不要保留旧入口或单独暴露写作 skill；`$otter write` 在内部调用 `sujianlin-write-skills`。

## 首次初始化

如果 `.paper-daily/profile.json` 不存在，先读 [冷启动流程](references/onboarding.md)。这是零数据冷启动：除非用户在这次调用中主动附带材料，否则假定系统不知道他的主题、背景和阅读历史。不要先发偏好问卷；先展示一组具体的领域入口，用户点选后再检索 6–8 篇真实论文卡。只有首位候选仍有实质歧义时，才追加一次基于两篇具体论文的二选一。收到选择后：

1. 按 [数据格式](references/data-model.md) 生成临时 profile JSON。
2. 运行 `python3 scripts/paperctl.py init <临时-profile.json>`。
3. 用两三句话复述今天会怎样推荐，随后删除临时文件。不要在初始化时展示完整画像字段。

用户在初始化命令里主动贴来的论文或阅读列表可以替代领域入口，但不得询问或假设其他材料存在。允许“都不想看”。不要要求他先把兴趣组织成研究问题。先生成第一轮推荐，再从实际反馈逐步识别读者正在解决的问题、已有知识和希望补齐的能力。

## 每日推荐

读取 profile、近期 `events.jsonl`、`inferences.json`、过去推荐和本地论文记录，再按 [推荐流程](references/recommendation.md) 工作。需要新论文时检索网络，以论文原始页面、会议页面、作者项目和机构官方报告为主要来源。候选必须先通过 [来源与学习价值门槛](references/source-quality.md)，再按个人匹配度排序；相关不等于值得精读。

每天默认交付一篇主读和最多两篇备选。主读必须给出：它连接到哪个当前目标、今天为什么值得读、来源类型与发表状态、预计阅读时间、需要的前置知识、可能不适合的原因。推荐理由要引用候选的具体贡献或实验，不写泛泛的“与你兴趣相关”。没有候选通过门槛时，明确说今天没有合格主读，可以只给“探索候选”，不得为了完成每日任务降低标准。

把候选审计信息写入 `.paper-daily/candidates/YYYY-MM-DD.json`，把最终选择写入 `.paper-daily/daily/YYYY-MM-DD.json`。推荐阶段只写私有的 `paper.json` 元数据，`sections` 必须省略或保持空数组；严禁用摘要改写、提纲或占位段落冒充正文。未完成写作门禁的论文不得同步到网站 catalog，不显示空文章、占位页或“正文稍后生成”的卡片。

`$otter write` 必须调用仓库内 `skills/sujianlin-write-skills` 的完整流程，产物放入 `.paper-daily/papers/<paper-id>/`。开始前运行 `python3 scripts/paperctl.py writing-begin <paper-id>`；若用户明确要求废弃旧稿重写，使用 `--restart`。根据论文类型调整重点：理论论文重推理，实验论文重设计与证据，系统论文重机制与边界，综述论文重分类依据与争议。

主线程只负责准备原始阅读目标、读者背景、论文原文和可核查证据，不写正文。必须新建一个**不继承对话历史的作者 agent**，只向它提供这些材料和 `sujianlin-write-skills`；不能提供主线程已经写过的摘要、讲解、推荐文案、用户对旧稿的批评或希望它得出的答案。作者 agent 从 evidence 开始形成 logic draft，并在逻辑审查和读者检查后负责修订直至 article。逻辑审查与首次阅读检查分别使用另外两个不继承历史的新上下文，三者不能是同一个 agent。工具不支持新上下文时，不得生成或发布完整精读稿；只能保留推荐卡并说明缺少写作运行条件。

每一阶段写完后立即登记，不能提前创建后续文件：

```sh
python3 scripts/paperctl.py writing-record <paper-id> evidence
python3 scripts/paperctl.py writing-record <paper-id> logic-draft
python3 scripts/paperctl.py writing-record <paper-id> logic-review
python3 scripts/paperctl.py writing-record <paper-id> reader-draft
python3 scripts/paperctl.py writing-record <paper-id> reader-report
python3 scripts/paperctl.py writing-record <paper-id> revision-notes
python3 scripts/paperctl.py writing-record <paper-id> article
```

登记 `article` 时脚本会调用 KaTeX 检查全部数学公式，并拒绝不兼容定界符、未闭合公式和非法 LaTeX；检查失败不得生成完成 manifest。`logic-review` 和 `reader-report` 必须来自 skill 要求的独立上下文。文章必须从 evidence 与 logic draft 生长出来；禁止先写最终稿，再倒填阶段文件。已有聊天回答、短导读或研究笔记只能作为素材放入 evidence，不能复制成 logic draft。不要把生成文章提交到框架仓库。`paperctl.py sync` 会校验阶段顺序、每阶段哈希链和最终 manifest；不要手写 `writing.json` 或 `writing-workflow.json`，也不要绕过门禁。

只有 `$otter write` 完成全部阶段后才运行：

```sh
python3 scripts/paperctl.py sync
```

`init` 与 `recommend` 不得为了展示推荐结果调用 sync 发布空文章；推荐记录留在 `.paper-daily/daily/` 和 `.paper-daily/papers/`，直到对应正文完成。

## 多来源调研

`$otter research` 按 [调研报告流程](references/research.md) 工作，并在内部调用 `sujianlin-write-skills` 的多来源调研模式。产物放在 `.paper-daily/reports/<report-id>/`，不得提交到公共仓库。报告元数据写入 `report.json`；至少包含与论文卡兼容的 `id`、中英文标题、年份、标签、预计阅读时间、调研价值和主要入口链接。

开始前运行：

```sh
python3 scripts/paperctl.py research-begin <report-id>
```

逐阶段登记，不能提前创建后续文件：

```sh
python3 scripts/paperctl.py research-record <report-id> scope
python3 scripts/paperctl.py research-record <report-id> sources
python3 scripts/paperctl.py research-record <report-id> evidence-map
python3 scripts/paperctl.py research-record <report-id> synthesis-draft
python3 scripts/paperctl.py research-record <report-id> logic-review
python3 scripts/paperctl.py research-record <report-id> reader-draft
python3 scripts/paperctl.py research-record <report-id> reader-report
python3 scripts/paperctl.py research-record <report-id> revision-notes
python3 scripts/paperctl.py research-record <report-id> article
```

完整调研报告同样由不继承主线程历史的新作者执笔；逻辑审查和首次阅读检查分别使用另外两个干净上下文。主线程只准备原始问题、读者背景和一手资料入口。作者负责范围、来源审计、证据矩阵与综合稿；审稿人只看原始问题、范围和综合稿，检查路线遗漏、比较口径、反例与时间边界；首次阅读者只看送读稿。没有三个独立上下文时不得发布完整报告。

报告完成全部门禁后运行 `python3 scripts/paperctl.py sync`。网站以“专题调研”标识，并与单篇精读一起按完成时间排序。未完成报告不得进入 catalog。

## 从反馈学习

显式“不感兴趣”是强负反馈；点赞、收藏和读完是强正反馈。短时打开、曝光后未打开、没有点赞只能作为弱信号，至少与另一个弱信号共同出现后才降低同类主题或写法的权重。区分“题目不对”“太基础”“太难”“暂时没空”，不能把时间不足误判为长期不感兴趣。

把模型推断出的偏好写入 `.paper-daily/inferences.json`，每条都保存证据事件、置信度、创建时间和复查时间。没有新证据时让推断衰减；不要静默改写用户亲自填写的 profile。

保留少量探索，不让画像变成过滤气泡。用户主动修改目标时，以新目标为准；历史行为只作为证据，不凌驾于用户当前表达。

## 边界

大模型负责语义理解、候选比较和推荐解释；脚本只负责验证、本地记录与网站同步。不要把不可解释的总分冒充客观质量，也不要因为模型确信就省略来源核验。
