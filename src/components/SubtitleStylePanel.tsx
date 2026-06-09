import React, { useEffect, useMemo, useState } from "react";
import type { SubtitleStyle, StylePreset } from "../types";

interface SubtitleStylePanelProps {
  englishStyle: SubtitleStyle;
  chineseStyle: SubtitleStyle;
  updateStyle: (lang: "english" | "chinese", updates: Partial<SubtitleStyle>) => void;
  stylePresets: StylePreset[];
  onSavePreset: (preset: StylePreset) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (preset: StylePreset) => void;
}

type FontOption = {
  value: string;
  label: string;
};

const FALLBACK_FONT_OPTIONS: FontOption[] = [
  { value: "Arial", label: "Arial" },
  { value: "Microsoft YaHei", label: "Microsoft YaHei" },
  { value: "SimSun", label: "SimSun" },
  { value: "SimHei", label: "SimHei" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "PingFang SC", label: "PingFang SC" },
  { value: "Noto Sans CJK SC", label: "Noto Sans CJK SC" },
];

function addFontOption(map: Map<string, FontOption>, value?: string | null, label?: string) {
  const normalized = value?.trim();
  if (!normalized) return;
  const key = normalized.toLocaleLowerCase();
  if (!map.has(key)) {
    map.set(key, { value: normalized, label: label ?? normalized });
  }
}

function isReadableFontName(font: string): boolean {
  const name = font.trim();
  return name.length > 0 && !name.includes("\uFFFD") && !/[\u0000-\u001F]/.test(name);
}

function getSubtitleStyleKey(style: SubtitleStyle): string {
  return [
    style.fontname,
    style.fontsize,
    style.color1,
    style.color3,
    style.color4,
    style.bold,
    style.italic,
    style.underline,
    style.outline,
    style.shadow,
    style.margin_l,
    style.margin_r,
    style.margin_v,
    style.offsetY,
  ].join("|");
}

function getPresetStyleKey(english: SubtitleStyle, chinese: SubtitleStyle): string {
  return `${getSubtitleStyleKey(english)}::${getSubtitleStyleKey(chinese)}`;
}

function createPresetName(presets: StylePreset[]): string {
  const names = new Set(presets.map((preset) => preset.name.trim().toLocaleLowerCase()));
  let index = presets.length + 1;
  while (names.has(`样式 ${index}`.toLocaleLowerCase())) {
    index += 1;
  }
  return `样式 ${index}`;
}

const FontSelect: React.FC<{
  value: string;
  options: FontOption[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase().includes(q) ||
      option.value.toLocaleLowerCase().includes(q)
    );
  }, [options, query]);

  const currentLabel = selected?.label ?? value;

  return (
    <div
      tabIndex={-1}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      style={{ position: "relative", minWidth: 0 }}
    >
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        title={currentLabel}
        style={{
          width: "100%",
          minWidth: 0,
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          fontSize: 13,
          backgroundColor: "#ffffff",
          color: "#374151",
          outline: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentLabel}
        </span>
        <span style={{ color: "#6b7280", fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 200,
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.14)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索字体"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                color: "#374151",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "8px 10px", color: "#9ca3af", fontSize: 12 }}>
                没有匹配字体
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  title={option.label}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    display: "block",
                    padding: "7px 10px",
                    border: "none",
                    backgroundColor: option.value === value ? "#dbeafe" : "transparent",
                    color: "#1f2937",
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StyleEditor: React.FC<{
  title: string;
  style: SubtitleStyle;
  fontOptions: FontOption[];
  onUpdate: (updates: Partial<SubtitleStyle>) => void;
}> = ({ title, style, fontOptions, onUpdate }) => {
  return (
    <div className="style-editor-section">
      <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600, color: '#374151' }}>
        {title}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '12px 16px',
          alignItems: 'start',
        }}
      >
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>字体</label>
          <FontSelect
            value={style.fontname}
            options={fontOptions}
            onChange={(fontname) => onUpdate({ fontname })}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
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
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>主文字颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color1}
              onChange={(e) => onUpdate({ color1: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', backgroundColor: '#ffffff' }}
            />
            <input
              type="text"
              value={style.color1}
              onChange={(e) => onUpdate({ color1: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace', backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>描边颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color3}
              onChange={(e) => onUpdate({ color3: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', backgroundColor: '#ffffff' }}
            />
            <input
              type="text"
              value={style.color3}
              onChange={(e) => onUpdate({ color3: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace', backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>阴影颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={style.color4}
              onChange={(e) => onUpdate({ color4: e.target.value })}
              style={{ width: 36, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', backgroundColor: '#ffffff' }}
            />
            <input
              type="text"
              value={style.color4}
              onChange={(e) => onUpdate({ color4: e.target.value })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace', backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
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
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={style.bold}
                onChange={(e) => onUpdate({ bold: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: style.bold ? 'bold' : 'normal', color: '#374151' }}>粗体 (Bold)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={style.italic}
                onChange={(e) => onUpdate({ italic: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontStyle: style.italic ? 'italic' : 'normal', color: '#374151' }}>斜体 (Italic)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={style.underline}
                onChange={(e) => onUpdate({ underline: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ textDecoration: style.underline ? 'underline' : 'none', color: '#374151' }}>下划线 (Underline)</span>
            </label>
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>左边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_l}
            onChange={(e) => onUpdate({ margin_l: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>右边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_r}
            onChange={(e) => onUpdate({ margin_r: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>垂直边距 (px)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={style.margin_v}
            onChange={(e) => onUpdate({ margin_v: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>垂直偏移 (px)</label>
          <input
            type="number"
            min={-300}
            max={300}
            value={style.offsetY}
            onChange={(e) => onUpdate({ offsetY: Number(e.target.value) })}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, backgroundColor: '#ffffff', color: '#374151', outline: 'none' }}
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
  stylePresets,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'english' | 'chinese'>('english');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const api = window.fontAPI || window.electronAPI;

    if (!api?.getSystemFonts) {
      setSystemFonts([]);
      return;
    }

    api.getSystemFonts()
      .then((fonts) => {
        if (cancelled) return;
        const cleanFonts = Array.from(
          new Set(fonts.map((font) => font.trim()).filter(isReadableFontName))
        ).sort((a, b) => a.localeCompare(b));
        setSystemFonts(cleanFonts);
      })
      .catch((error) => {
        console.warn("SubtitleStylePanel: failed to sync system fonts", error);
        if (!cancelled) setSystemFonts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fontOptions = useMemo(() => {
    const options = new Map<string, FontOption>();
    addFontOption(options, englishStyle.fontname);
    addFontOption(options, chineseStyle.fontname);

    const source = systemFonts.length > 0
      ? systemFonts.map((font) => ({ value: font, label: font }))
      : FALLBACK_FONT_OPTIONS;

    for (const font of source) {
      addFontOption(options, font.value, font.label);
    }

    for (const font of FALLBACK_FONT_OPTIONS) {
      addFontOption(options, font.value, font.label);
    }

    return Array.from(options.values());
  }, [chineseStyle.fontname, englishStyle.fontname, systemFonts]);

  const currentStyleKey = useMemo(
    () => getPresetStyleKey(englishStyle, chineseStyle),
    [englishStyle, chineseStyle]
  );

  const currentPreset = useMemo(
    () => stylePresets.find((preset) => getPresetStyleKey(preset.english, preset.chinese) === currentStyleKey) ?? null,
    [currentStyleKey, stylePresets]
  );

  const handleStartAddCurrentPreset = () => {
    setNewPresetName(createPresetName(stylePresets));
    setAddingPreset(true);
  };

  const handleSaveCurrentPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const existingPreset = stylePresets.find(
      (preset) => preset.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    const preset: StylePreset = {
      id: existingPreset?.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      english: { ...englishStyle },
      chinese: { ...chineseStyle },
    };
    onSavePreset(preset);
    setAddingPreset(false);
    setNewPresetName("");
    setShowPresetMenu(false);
  };

  const handleCancelAddPreset = () => {
    setAddingPreset(false);
    setNewPresetName("");
  };

  const handleApplyPreset = (preset: StylePreset) => {
    onApplyPreset(preset);
    setShowPresetMenu(false);
  };

  return (
    <div
      className="subtitle-style-panel"
      style={{
        width: 500,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <button
          onClick={() => setActiveTab('english')}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: 'none',
            backgroundColor: activeTab === 'english' ? '#ffffff' : 'transparent',
            color: activeTab === 'english' ? '#1f2937' : '#6b7280',
            fontWeight: activeTab === 'english' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
            borderBottom: activeTab === 'english' ? '2px solid #4299e1' : '2px solid transparent',
          }}
        >
          英文字幕 (English)
        </button>
        <button
          onClick={() => setActiveTab('chinese')}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: 'none',
            backgroundColor: activeTab === 'chinese' ? '#ffffff' : 'transparent',
            color: activeTab === 'chinese' ? '#1f2937' : '#6b7280',
            fontWeight: activeTab === 'chinese' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
            borderBottom: activeTab === 'chinese' ? '2px solid #4299e1' : '2px solid transparent',
          }}
        >
          中文字幕 (Chinese)
        </button>
      </div>

      {/* 预设管理 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <div
          tabIndex={-1}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setShowPresetMenu(false);
              setAddingPreset(false);
            }
          }}
          style={{
            position: 'relative',
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setShowPresetMenu((next) => !next)}
            style={{
              width: '100%',
              minWidth: 0,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span style={{ color: '#6b7280', flexShrink: 0 }}>样式预设</span>
            <span
              style={{
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              {currentPreset?.name ?? '当前样式'}
            </span>
            <span style={{ color: '#6b7280', fontSize: 10 }}>▼</span>
          </button>

          {showPresetMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 240,
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.16)',
                overflow: 'hidden',
              }}
            >
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                {stylePresets.length === 0 ? (
                  <div style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    暂无可选样式
                  </div>
                ) : (
                  stylePresets.map((preset) => {
                    const selected = currentPreset?.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: selected ? '#dbeafe' : '#ffffff',
                        }}
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleApplyPreset(preset)}
                          title={preset.name}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '8px 10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#374151',
                            cursor: 'pointer',
                            fontSize: 13,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {preset.name}
                          </span>
                          {selected && <span style={{ color: '#2563eb', fontSize: 12, flexShrink: 0 }}>当前</span>}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeletePreset(preset.id);
                          }}
                          style={{
                            width: 48,
                            border: 'none',
                            borderLeft: '1px solid #f3f4f6',
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          删除
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {addingPreset ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    padding: 8,
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                  }}
                >
                  <input
                    autoFocus
                    value={newPresetName}
                    onChange={(event) => setNewPresetName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSaveCurrentPreset();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        handleCancelAddPreset();
                      }
                    }}
                    placeholder="输入样式名称"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '6px 8px',
                      borderRadius: 4,
                      border: '1px solid #d1d5db',
                      color: '#374151',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleSaveCurrentPreset}
                    disabled={!newPresetName.trim()}
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: newPresetName.trim() ? '#4299e1' : '#cbd5e1',
                      color: '#ffffff',
                      cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 12,
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleCancelAddPreset}
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      backgroundColor: '#ffffff',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleStartAddCurrentPreset}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  添加当前样式
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 样式编辑器 */}
      <div style={{ padding: '16px' }}>
        {activeTab === 'english' ? (
          <StyleEditor
            title="英文字幕样式 (English)"
            style={englishStyle}
            fontOptions={fontOptions}
            onUpdate={(updates) => updateStyle('english', updates)}
          />
        ) : (
          <StyleEditor
            title="中文字幕样式 (Chinese)"
            style={chineseStyle}
            fontOptions={fontOptions}
            onUpdate={(updates) => updateStyle('chinese', updates)}
          />
        )}
      </div>
    </div>
  );
};

export default SubtitleStylePanel;
