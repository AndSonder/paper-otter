# Contributing

这个仓库维护推荐框架，不收录具体用户的论文文章、画像或阅读历史。

## 可以提交

- 推荐策略、画像结构和反馈解释的改进；
- 网站、数据同步与行为记录代码；
- 可复用的 skill 指令、验证脚本和测试；
- 不包含论文正文的通用示例或测试夹具。

## 不应提交

- `.paper-daily/`、`public/local/` 或导出的个人阅读数据；
- 论文 PDF、arXiv 源码、论文原图或生成的完整精读稿；
- 凭据、本地数据库、构建产物和 Wrangler 状态。

修改推荐 skill 时，请说明它解决了哪一种可观察的推荐失败。修改数据格式时应保持版本字段，并提供迁移方案。

提交前运行：

```sh
npm run lint
npm run framework:check
npm run build
npm test
```
