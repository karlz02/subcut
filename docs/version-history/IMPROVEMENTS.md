# EchoClip MVP - Version History

## v0.1.0 (2026-05-22)

### 新增功能
- **MKV 导入**: 支持拖拽和文件选择导入 MKV 视频
- **字幕提取**: 自动从 MKV 内封字幕轨提取 SRT/ASS 格式字幕
- **字幕解析**: 支持 SRT 和 ASS/SSA 格式，自动过滤空字幕和符号字幕
- **句子列表**: 展示所有字幕句子，支持搜索过滤
- **视频切割**: 按字幕时间轴批量切割句子级视频片段
- **片段预览**: 每句可单独播放，支持循环和慢速（0.5x-1.5x）
- **ZIP 导出**: 导出 clips 文件夹 + metadata.json

### 技术方案
- React 19 + TypeScript + Vite 6
- FFmpeg.wasm 0.12 (浏览器端 WASM 视频处理)
- 自写 ASS/SRT 解析器（零外部依赖）
- JSZip 打包导出
- 深色主题极简 UI

### 已知限制
- 仅支持文本字幕（SRT/ASS），不支持 PGS/图片字幕
- 大文件受浏览器内存限制（建议 < 1GB）
- 需要 COOP/COEP 响应头（Vite dev server 已配置）
- 流拷贝模式下，部分编码格式可能需要重编码
