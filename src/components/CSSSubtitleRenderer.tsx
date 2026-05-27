import React, { useMemo } from 'react';
import type { SubtitleStyle } from '../types';

interface CSSSubtitleRendererProps {
  englishText?: string;
  chineseText?: string;
  englishStyle: SubtitleStyle;
  chineseStyle: SubtitleStyle;
  width?: number;
  height?: number;
}

/**
 * 将 SubtitleStyle 映射为 React.CSSProperties
 * 修复：统一使用 types.ts 中的属性名（fontname/fontsize/color1 等）
 */
function buildTextStyle(style: SubtitleStyle, isChinese: boolean): React.CSSProperties {
  // 修复：使用正确的属性名（与 types.ts 保持一致）
  const outlineW = style.outline ?? 2;
  const outlineC = style.color3 ?? '#000000';
  const shadowW = style.shadow ?? 1;
  const shadowC = style.color4 ?? '#000000';

  // 构建描边效果：使用多层 text-shadow 模拟描边
  const shadows: string[] = [];
  if (outlineW > 0) {
    const steps = Math.ceil(outlineW);
    for (let x = -steps; x <= steps; x++) {
      for (let y = -steps; y <= steps; y++) {
        if (x === 0 && y === 0) continue;
        if (Math.sqrt(x * x + y * y) <= outlineW + 0.5) {
          shadows.push(`${x}px ${y}px 0 ${outlineC}`);
        }
      }
    }
  }

  // 添加阴影层
  if (shadowW > 0) {
    shadows.push(`${shadowW}px ${shadowW}px ${shadowW * 2}px ${shadowC}`);
  }

  return {
    fontFamily: `"${style.fontname || (isChinese ? 'Microsoft YaHei' : 'Arial')}"`,
    fontSize: `${style.fontsize ?? (isChinese ? 52 : 48)}px`,
    color: style.color1 || '#FFFFFF',
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
    marginLeft: `${style.margin_l ?? 0}px`,
    marginRight: `${style.margin_r ?? 0}px`,
    marginTop: `${style.margin_v ?? 0}px`,
    marginBottom: `${style.margin_v ?? 0}px`,
    transform: style.offsetY ? `translateY(${style.offsetY}px)` : undefined,
    position: 'relative',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: '0.02em',
  };
}

const CSSSubtitleRenderer: React.FC<CSSSubtitleRendererProps> = ({
  englishText,
  chineseText,
  englishStyle,
  chineseStyle,
}) => {
  const enStyle = useMemo(
    () => buildTextStyle(englishStyle, false),
    [englishStyle]
  );
  const cnStyle = useMemo(
    () => buildTextStyle(chineseStyle, true),
    [chineseStyle]
  );

  const cnOffsetY = chineseStyle.offsetY ?? 0;
  const enOffsetY = englishStyle.offsetY ?? 0;

  return (
    <div
      className="css-subtitle-renderer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {chineseText && (
        <div
          className="subtitle-line subtitle-cn"
          style={{
            position: 'absolute',
            bottom: `calc(${chineseStyle.margin_v ?? 40}px + ${cnOffsetY}px)`,
            left: `${chineseStyle.margin_l ?? 20}px`,
            right: `${chineseStyle.margin_r ?? 20}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <span style={cnStyle}>{chineseText}</span>
        </div>
      )}

      {englishText && (
        <div
          className="subtitle-line subtitle-en"
          style={{
            position: 'absolute',
            bottom: chineseText
              ? `calc(${englishStyle.margin_v ?? 40}px + ${enOffsetY}px + ${chineseStyle.fontsize ?? 52}px + 8px)`
              : `calc(${englishStyle.margin_v ?? 40}px + ${enOffsetY}px)`,
            left: `${englishStyle.margin_l ?? 20}px`,
            right: `${englishStyle.margin_r ?? 20}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <span style={enStyle}>{englishText}</span>
        </div>
      )}
    </div>
  );
};

export default CSSSubtitleRenderer;
