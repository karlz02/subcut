import React from 'react';
import type { SubtitleStyle } from '../types';

interface SubtitleStylePanelProps {
  englishStyle: SubtitleStyle;
  chineseStyle: SubtitleStyle;
  updateStyle: (lang: 'english' | 'chinese', updates: Partial<SubtitleStyle>) => void;
}

const FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimSun', label: '宋体' },
  { value: 'SimHei', label: '黑体' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'PingFang SC', label: '苹方' },
  { value: 'Noto Sans CJK SC', label: 'Noto Sans CJK' },
];

const StyleEditor: React.FC<{
  title: string;
  style: SubtitleStyle;
  onUpdate: (updates: Partial<SubtitleStyle>) => void;
}> = ({ title, style, onUpdate }) => {
  return (
    <div className="style-editor-section" style={{ marginBottom: 28 }}>
      <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
        {title}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px 16px',
          alignItems: 'start',
        }}
      >
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>字体</label>
          <select
            value={style.fontname}
            onChange={(e) => onUpdate({ fontname: e.target.value })}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              backgroundColor: '#fff',
            }}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
            字号 ({style.fontsize}px)
          </label>
          <input
            type="range"
            min={12}
            max={120}
            step={1}
            value={style.fontsize}
            onChange={(e) => onUpdate({ fontsize: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>主文字颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color1}
              onChange={(e) => onUpdate({ color1: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={style.color1}
              onChange={(e) => onUpdate({ color1: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>描边颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color3}
              onChange={(e) => onUpdate({ color3: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={style.color3}
              onChange={(e) => onUpdate({ color3: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>阴影颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color4}
              onChange={(e) => onUpdate({ color4: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={style.color4}
              onChange={(e) => onUpdate({ color4: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
            描边宽度 ({style.outline}px)
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={style.outline}
            onChange={(e) => onUpdate({ outline: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
            阴影宽度 ({style.shadow}px)
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={style.shadow}
            onChange={(e) => onUpdate({ shadow: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', gap: 20, padding: '8px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              <input
                type="checkbox"
                checked={style.bold}
                onChange={(e) => onUpdate({ bold: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: style.bold ? 'bold' : 'normal' }}>粗体 (Bold)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              <input
                type="checkbox"
                checked={style.italic}
                onChange={(e) => onUpdate({ italic: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontStyle: style.italic ? 'italic' : 'normal' }}>斜体 (Italic)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              <input
                type="checkbox"
                checked={style.underline}
                onChange={(e) => onUpdate({ underline: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ textDecoration: style.underline ? 'underline' : 'none' }}>下划线 (Underline)</span>
            </label>
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>左边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_l}
            onChange={(e) => onUpdate({ margin_l: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>右边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_r}
            onChange={(e) => onUpdate({ margin_r: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>垂直边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_v}
            onChange={(e) => onUpdate({ margin_v: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>垂直偏移 (px)</label>
          <input
            type="number"
            min={-300}
            max={300}
            value={style.offsetY}
            onChange={(e) => onUpdate({ offsetY: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
};

const SubtitleStylePanel: React.FC<SubtitleStylePanelProps> = ({
  englishStyle,
  chineseStyle,
  updateStyle,
}) => {
  return (
    <div
      className="subtitle-style-panel"
      style={{
        padding: 20,
        maxWidth: 560,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
      }}
    >
      <StyleEditor
        title="英文字幕样式 (English)"
        style={englishStyle}
        onUpdate={(updates) => updateStyle('english', updates)}
      />

      <div style={{ height: 1, backgroundColor: '#e5e7eb', margin: '20px 0' }} />

      <StyleEditor
        title="中文字幕样式 (Chinese)"
        style={chineseStyle}
        onUpdate={(updates) => updateStyle('chinese', updates)}
      />
    </div>
  );
};

export default SubtitleStylePanel;
