import React, { useState, useCallback, useMemo } from 'react';
import type { SubtitleStyle } from '../types';
import './SubtitleStylePanel.css';

interface Props {
  englishStyle: SubtitleStyle;
  chineseStyle: SubtitleStyle;
  onEnglishStyleChange: (style: SubtitleStyle) => void;
  onChineseStyleChange: (style: SubtitleStyle) => void;
  onClose: () => void;
}

const SAFE_FONTS = [
  'Arial', 'Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'FangSong',
  'DengXian', 'Verdana', 'Times New Roman', 'Georgia', 'Consolas'
];

const SubtitleStylePanel: React.FC<Props> = ({
  englishStyle,
  chineseStyle,
  onEnglishStyleChange,
  onChineseStyleChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'chinese' | 'english'>('chinese');

  const currentStyle = activeTab === 'chinese' ? chineseStyle : englishStyle;
  const setCurrentStyle = activeTab === 'chinese' ? onChineseStyleChange : onEnglishStyleChange;

  const updateStyle = useCallback((updates: Partial<SubtitleStyle>) => {
    setCurrentStyle((prev) => ({ ...prev, ...updates }));
  }, [setCurrentStyle]);

  const fontOptions = useMemo(() =>
    SAFE_FONTS.map(font => ({
      value: font,
      label: font === 'Microsoft YaHei' ? '微软雅黑' : font
    })),
  []);

  const previewText = activeTab === 'chinese' ? '这是中文字幕预览' : 'This is English subtitle preview';

  const textStyle = {
    fontFamily: currentStyle.fontname || 'Arial',
    fontSize: `${currentStyle.fontsize || 48}px`,
    color: currentStyle.color1 || '#FFFFFF',
    textShadow: currentStyle.outline || currentStyle.shadow
      ? `${currentStyle.outline ? `0 0 ${currentStyle.outline}px ${currentStyle.color3 || '#000000'},` : ''}
        ${currentStyle.shadow ? `${currentStyle.shadow}px ${currentStyle.shadow}px ${currentStyle.shadow}px ${currentStyle.color4 || '#000000'}` : ''}`
      : 'none',
    fontWeight: currentStyle.bold ? 'bold' : 'normal',
    fontStyle: currentStyle.italic ? 'italic' : 'normal',
    textDecoration: currentStyle.underline ? 'underline' : 'none',
    textAlign: 'center' as const,
    lineHeight: '1.4',
  };

  return (
    <div className="style-panel">
      <div className="style-panel-header">
        <h3>字幕样式</h3>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="style-panel-tabs">
        <button
          className={`style-panel-tab${activeTab === 'chinese' ? ' active' : ''}`}
          onClick={() => setActiveTab('chinese')}
        >
          中文字幕
        </button>
        <button
          className={`style-panel-tab${activeTab === 'english' ? ' active' : ''}`}
          onClick={() => setActiveTab('english')}
        >
          英文字幕
        </button>
      </div>

      <div className="style-panel-content">
        {/* 预览区域 */}
        <div className="style-preview">
          <div className="style-preview-title">实时预览</div>
          <div className="style-preview-text" style={textStyle}>
            {previewText}
          </div>
        </div>

        <div className="style-divider"></div>

        {/* 字体设置 */}
        <div className="style-section">
          <div className="style-section-title">字体设置</div>
          
          <div className="style-row">
            <label className="style-label">字体</label>
            <div className="style-control-group">
              <select
                className="style-select"
                value={currentStyle.fontname || 'Arial'}
                onChange={(e) => updateStyle({ fontname: e.target.value })}
              >
                {fontOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="style-row">
            <label className="style-label">字号</label>
            <div className="style-control-group">
              <input
                className="style-input-number"
                type="number"
                value={currentStyle.fontsize || 48}
                onChange={(e) => updateStyle({ fontsize: parseInt(e.target.value) })}
                min={20}
                max={120}
              />
              <span className="style-unit">px</span>
            </div>
          </div>

          <div className="style-row">
            <label className="style-label">颜色</label>
            <div className="style-control-group">
              <div className="style-color-picker" style={{ background: currentStyle.color1 || '#FFFFFF' }}>
                <input
                  type="color"
                  value={currentStyle.color1 || '#FFFFFF'}
                  onChange={(e) => updateStyle({ color1: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="style-divider"></div>

        {/* 描边设置 */}
        <div className="style-section">
          <div className="style-section-title">描边设置</div>
          
          <div className="style-combo-row">
            <span className="style-combo-label">描边</span>
            <div className="style-combo-content">
              <div className="style-combo-color" style={{ background: currentStyle.color3 || '#000000' }}>
                <input
                  type="color"
                  value={currentStyle.color3 || '#000000'}
                  onChange={(e) => updateStyle({ color3: e.target.value })}
                />
              </div>
              <input
                className="style-combo-input"
                type="number"
                value={currentStyle.outline || 4}
                onChange={(e) => updateStyle({ outline: parseInt(e.target.value) })}
                min={0}
                max={10}
              />
              <span className="style-combo-unit">px</span>
            </div>
          </div>
        </div>

        {/* 阴影设置 */}
        <div className="style-section">
          <div className="style-section-title">阴影设置</div>
          
          <div className="style-combo-row">
            <span className="style-combo-label">阴影</span>
            <div className="style-combo-content">
              <div className="style-combo-color" style={{ background: currentStyle.color4 || '#000000' }}>
                <input
                  type="color"
                  value={currentStyle.color4 || '#000000'}
                  onChange={(e) => updateStyle({ color4: e.target.value })}
                />
              </div>
              <input
                className="style-combo-input"
                type="number"
                value={currentStyle.shadow || 1}
                onChange={(e) => updateStyle({ shadow: parseInt(e.target.value) })}
                min={0}
                max={10}
              />
              <span className="style-combo-unit">px</span>
            </div>
          </div>
        </div>

        <div className="style-divider"></div>

        {/* 文字样式 */}
        <div className="style-section">
          <div className="style-section-title">文字样式</div>
          
          <div className="style-row">
            <label className="style-label">样式</label>
            <div className="style-button-group">
              <button
                className={`style-toggle-btn${currentStyle.bold ? ' active' : ''}`}
                onClick={() => updateStyle({ bold: !currentStyle.bold })}
                title="粗体"
              >
                B
              </button>
              <button
                className={`style-toggle-btn${currentStyle.italic ? ' active' : ''}`}
                onClick={() => updateStyle({ italic: !currentStyle.italic })}
                title="斜体"
              >
                I
              </button>
              <button
                className={`style-toggle-btn${currentStyle.underline ? ' active' : ''}`}
                onClick={() => updateStyle({ underline: !currentStyle.underline })}
                title="下划线"
              >
                U
              </button>
            </div>
          </div>
        </div>

        <div className="style-divider"></div>

        {/* 位置设置 */}
        <div className="style-section">
          <div className="style-section-title">位置设置</div>
          
          <div className="style-row">
            <label className="style-label">底部距离</label>
            <div className="style-control-group">
              <input
                className="style-input-number"
                type="number"
                value={currentStyle.margin_v || 45}
                onChange={(e) => updateStyle({ margin_v: parseInt(e.target.value) })}
                min={10}
                max={200}
              />
              <span className="style-unit">px</span>
            </div>
          </div>
        </div>
      </div>

      <div className="style-panel-footer">
        <button className="style-btn-cancel" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
};

export default SubtitleStylePanel;
