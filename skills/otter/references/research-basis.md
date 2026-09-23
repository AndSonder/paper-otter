# 调研流程的方法依据

这份说明记录 `$otter research` 借鉴的方法，避免把“调用多个 agent”误当成调研质量。

## 借鉴了什么

- Google 的 [AI Co-Scientist](https://arxiv.org/abs/2502.18864) 用生成、反思、排序和演化形成假设，并通过成对比较分配更多推理资源。Paper Otter 只借用竞争框架与反例挑战，不宣称自动产生经过验证的新知识。
- Google 的 [Gemini Deep Research](https://ai.google.dev/gemini-api/docs/deep-research) 强调计划、迭代搜索和综合。Paper Otter 因此保存查询日志、覆盖缺口与停止条件，不把一次搜索结果直接写成报告。
- [OpenScholar](https://arxiv.org/abs/2411.14199) 把科学检索、逐处引用和自反馈结合起来。Paper Otter 因此要求每个关键主张能回到原始证据，并单独检查引用是否真的支持正文。
- [STORM](https://arxiv.org/abs/2402.14207) 在写作前从多种读者视角提问并组织提纲。Paper Otter 将这一思想收敛为多个分类框架的比较，避免按论文顺序堆摘要。
- [Agent Laboratory](https://arxiv.org/abs/2501.04227) 的实验显示，阶段性人工反馈能改善自动研究结果。Paper Otter 保留可读的阶段文件，让读者能在范围、证据和成稿之间介入。
- [The AI Scientist](https://arxiv.org/abs/2408.06292) 展示了想法、实验、论文和模拟评审的端到端闭环，也暴露了自动评审不能替代真实验证的问题。Paper Otter 的 research 默认是证据综合；只有存在可执行实验和明确指标时，才把实验结论写入报告。

## 没有照搬什么

个人阅读调研通常没有实验 oracle，也没有必要让大量 agent 自由发散。并行只用于可以独立核查的路线；范围界定、证据合并和最终叙事保持串行，否则不同口径会被过早压成一个结论。模型评分只用于发现分歧，不能成为证据。

流程的目标是生成可读、可核查的中文技术调研，而不是自动投稿。报告必须区分原文事实、作者解释和仍待验证的假设。
