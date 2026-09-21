export default function Timeline() {
  return <figure className="timeline-figure" aria-label="串行执行与重叠执行的概念对比，不代表实测性能">
    <div className="timeline-row"><span>常规执行</span><div className="lanes sequential"><i className="compute">计算 A</i><i className="comm">通信 B</i><i className="compute">计算 C</i><i className="comm">通信 D</i></div></div>
    <div className="timeline-row"><span>重叠执行</span><div className="lanes overlap"><i className="compute first">计算 A</i><i className="compute second">计算 C</i><i className="comm first">通信 B</i><i className="comm second">通信 D</i></div></div>
    <div className="time-axis">时间 →</div><div className="legend"><span><i className="compute" />计算</span><span><i className="comm" />通信</span></div>
    <figcaption>重叠概念示意 · 假设依赖允许 · 非论文实测数据</figcaption>
  </figure>;
}
