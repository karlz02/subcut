# Dev Log

## 2026-05-22 - v0.1.0 Initial Build

### 技术方案
- React 19 + TypeScript + Vite 6
- FFmpeg.wasm 0.12 (浏览器端视频处理)
- 自写 SRT/ASS 解析器
- JSZip + file-saver 导出

### 关键决策
1. **FFmpeg.wasm COOP/COEP**: 通过 Vite server.headers 配置 Cross-Origin-Opener-Policy 和 Cross-Origin-Embedder-Policy，解决 SharedArrayBuffer 要求
2. **字幕提取**: 使用 ffmpeg -map 0:s:0 提取第一轨字幕为 SRT，失败则回退 ASS
3. **视频切割**: 使用 -c copy 流拷贝模式，避免重编码，速度快
4. **不做后端**: 全部浏览器端处理，文件通过 File API 读取

### 已知限制
- 仅支持文本字幕（SRT/ASS），不支持 PGS 图形字幕
- 大文件（>1GB）可能受浏览器内存限制
- COEP=require-corp 可能影响某些外部资源加载
- 切割使用 -c copy，如果源视频编码不兼容 mp4 容器需要重编码
