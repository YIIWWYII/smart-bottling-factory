import DataDetails from './DataDetails';
import { useEffect, useRef, useState } from 'react';

export default function Chart({ values, color = '#a8e0c2', grid = '#ffffff10', type = 'line', fill = true, label = '数据趋势', source = '图表当前数据', unit = '' }) {
  const ref = useRef(null), [detail,setDetail]=useState(null);
  const show=()=>setDetail({title:label,source,at:Date.now(),columns:['采样序号',unit?`数值（${unit}）`:'数值'],rows:(values||[]).map((v,i)=>[i+1,v])});
  useEffect(() => {
    const canvas = ref.current;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      if (!values?.length) { ctx.fillStyle=color; ctx.font='14px sans-serif'; ctx.fillText('等待设备采样',12,height/2); return; }
      const top = 12, bottom = height - 12, max = Math.max(...values) * 1.15, min = type === 'bar' ? 0 : Math.min(...values) * .7;
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const y = top + (bottom - top) * i / 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      if (type === 'bar') {
        const step = width / values.length;
        values.forEach((value, i) => { const h = (value - min) / (max - min || 1) * (bottom - top); ctx.fillStyle = i === values.length - 1 ? color : color + '80'; ctx.fillRect(i * step + 3, bottom - h, Math.max(2, step - 6), h); });
      } else {
        const points = values.map((v, i) => [i / (values.length - 1 || 1) * width, bottom - (v - min) / (max - min || 1) * (bottom - top)]);
        const path = () => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
        if (fill) { path(); ctx.lineTo(width, bottom); ctx.lineTo(0, bottom); ctx.closePath(); const gradient = ctx.createLinearGradient(0, top, 0, bottom); gradient.addColorStop(0, color + '30'); gradient.addColorStop(1, color + '00'); ctx.fillStyle = gradient; ctx.fill(); }
        path(); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.stroke();
        const last = points.at(-1); ctx.beginPath(); ctx.arc(last[0] - 3, last[1], 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      }
    };
    const observer = new ResizeObserver(draw); observer.observe(canvas); draw();
    return () => observer.disconnect();
  }, [values, color, grid, type, fill]);
  return <><canvas ref={ref} className="chart interactive-chart" role="button" tabIndex={0} aria-label={label+'，点击查看具体数据'} onClick={show} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}}}/>{detail&&<DataDetails detail={detail} onClose={()=>setDetail(null)}/>}</>;
}
