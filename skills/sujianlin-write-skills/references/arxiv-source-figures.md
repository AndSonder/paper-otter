# 从 arXiv 源码定位原图

适用于需要讲解论文图、公式与正文关系的阅读稿。优先固定版本，避免图和正文来自不同版本。[官方源码说明](https://info.arxiv.org/help/ir.html)、[解包说明](https://info.arxiv.org/help/unpack.html)。

## 实际步骤

1. 打开论文 abstract 页，选定如 `2205.14135v2` 的版本，检查实际 TeX Source 链接。若只有 Other formats，进入后查找；没有源码则记录并回退到官方 HTML 图或同版 PDF 图区。
2. 可运行本 skill 的 `scripts/arxiv_source_assets.py <版本号> <新目录>`。脚本仅依赖 Python 3.9+ 标准库，从 abstract 发现固定版本源码链接，下载后安全解包；保存来源、版本、SHA256、license 元数据与未经核验的图候选。输出目录必须尚不存在。
3. 阅读候选指向的 `includegraphics`、`caption`、`label` 和正文 `ref`，跟踪根文件 `input/include`、宏与 `graphicspath`。脚本只是有限静态搜索，不展开宏、不判断条件、不推断图号。遗漏候选不等于没有图。
4. 实际打开图片；PDF/EPS 原图需用可用工具渲染。对照同版 PDF 或官方 HTML，确认图号、子图、坐标、图例和适用条件。仅在人工核对后记录 verified，并保留原始候选索引。
5. 中文稿中保留论文、版本、图号和原图路径。先告诉读者看哪里，再解释图支持的结论。原图英文标签可在图注解释，不改造实验数据。原图过密时，先确认正文要求观察的细节能在栏宽内辨认；必要时配清晰局部或示意图，整图及高清入口供参照。裁切或重绘须注明具体改动并保留整图来源。

命令示例（将 `<skill-dir>` 替换为当前 SKILL.md 所在目录）：

```sh
python3 <skill-dir>/scripts/arxiv_source_assets.py 2205.14135v2 ./paper-assets-2205.14135v2
```

## 限制与回退

- 只支持固定版本的现代 arXiv ID，以及 abstract 直接提供的 `/src/<版本>` 链接；其他入口人工处理，不把猜测 URL 当作已发现来源。
- 支持 tar 或 gzip 中的 tar/单 TeX。限下载 32 MiB、展开 128 MiB、单文件 32 MiB、4000 成员。拒绝越界路径、链接及特殊文件；不执行下载的 TeX、脚本或构建命令。
- 只读源码；不为生成图运行整篇 TeX。TikZ/动态生成图从同版 HTML/PDF 取，不能把无法取得的原图编出来。
- 正则结果可能受宏、子图环境和条件分支影响。只能称“候选”，不能仅按文件名或遍历顺序认定 Figure N。
- 本次已实际验证 FlashAttention `2205.14135v2` 的 `figs/banner_pdf.pdf` → `figs/banner.tex` caption/label → 官方 HTML Figure 1。此例证明流程可用，不代表所有论文都适用。

图片与原 caption 可留作个人阅读证据。来源及许可元数据一并保留，便于以后追溯。
