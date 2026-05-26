import React, { useMemo } from 'react';

interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowWidth?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: number;
  marginL?: number;
  marginR?: number;
  marginV?: number;
}

interface Props {
  englishText: string;
  chineseText: string;
  englishStyle: SubtitleStyle;
  chineseStyle: SubtitleStyle;
  visible?: boolean;
}

const CSSSubtitleRenderer: React.FC<Props> = ({
  englishText,
  chineseText,
  englishStyle,
  chineseStyle,
  visible = true,
}) => {
  const enPos = useMemo(() => buildPositionStyle(englishStyle), [englishStyle]);
  const zhPos = useMemo(() => buildPositionStyle(chineseStyle), [chineseStyle]);
  const enTextStyle = useMemo(() => buildTextStyle(englishStyle, false), [englishStyle]);
  const zhTextStyle = useMemo(() => buildTextStyle(chineseStyle, true), [chineseStyle]);

  if (!visible || (!englishText && !chineseText)) return null;

  return (
    <div className="subtitle-overlay" style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 30,
      overflow: 'hidden',
    }}>
      {chineseText && (
        <div className="subtitle-line zh" style={{ ...zhTextStyle, ...zhPos }}>
          {chineseText}
        </div>
      )}
      {englishText && (
        <div className="subtitle-line en" style={{ ...enTextStyle, ...enPos }}>
          {englishText}
        </div>
      )}
    </div>
  );
};

// 位置计算（底部居中为主）
function buildPositionStyle(style: SubtitleStyle): React.CSSProperties {
  const marginV = style.marginV ?? 45;
  return {
    position: 'absolute',
    left: '50%',
    bottom: `${marginV}px`,
    transform: 'translateX(-50%)',
    maxWidth: '90%',
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
}

// 文字样式
function buildTextStyle(style: SubtitleStyle, isChinese: boolean): React.CSSProperties {
  const outlineW = style.outlineWidth ?? 4;
  const outlineC = style.outlineColor ?? '#000000';
  const shadowW = style.shadowWidth ?? 1;
  const shadowC = style.shadowColor ?? '#000000';

  const shadows = [
    `${outlineW}px 0 0 ${outlineC}`,
    `${-outlineW}px 0 0 ${outlineC}`,
    `0 ${outlineW}px 0 ${outlineC}`,
    `0 ${-outlineW}px 0 ${outlineC}`,
    `${outlineW}px ${outlineW}px 0 ${outlineC}`,
    `${-outlineW}px ${-outlineW}px 0 ${outlineC}`,
  ];
  if (shadowW > 0) shadows.push(`${shadowW}px ${shadowW}px ${shadowW}px ${shadowC}`);

  return {
    fontFamily: isChinese
      ? `"${style.fontFamily || 'Microsoft YaHei'}", "SimHei", "Arial", sans-serif`
      : `"${style.fontFamily || 'Arial'}", sans-serif`,
    fontSize: `${style.fontSize ?? 52}px`,
    color: style.color ?? '#FFFFFF',
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : undefined,
    textShadow: shadows.join(', '),
    padding: '6px 14px',
    lineHeight: '1.3',
    display: 'inline-block',
  };
}

export default CSSSubtitleRenderer;
