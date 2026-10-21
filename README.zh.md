# dsh-pixel-studio

[English](README.md) | 中文

[![CI](https://github.com/Fantety/dsh-pixel-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Fantety/dsh-pixel-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的
**像素画 / 像素动画生成插件**。模型可以用 oy-pixel 风格的 shader 脚本程序化
生成，也可以编写调色板索引网格或使用模板 + 动作参数；插件把结果显示为
聊天内原生 Canvas，并同时导出可直接用于游戏开发的素材文件。

![模板总览](examples/template-gallery.png)

![原生幽灵动画](examples/native-ghost/native-ghost-preview.png)

![程序化 shader 场景](examples/shader-horizon/shader-horizon-preview.png)

## 特性

- **聊天内原生画布**：播放/暂停、逐帧、1-24× 最近邻缩放、网格、洋葱皮、
  调色板、craft 分数；不再使用交付物卡片或独立 viewer 作为主界面。
- **三个工具**：`pixel_shader` 用程序化脚本生成形状、渐变、纹理和动画；
  `pixel_art` 生成静态像素画；`pixel_animation` 支持显式逐帧或基础精灵 +
  动作预设。
- **oy-pixel 同构 shader 设计**：Canvas 绘图 API、`pal/mix/hsv/alpha/rand/noise`、
  `time/phase/frame_index/frame_count`、确定性种子、形状裁剪、`stamp`。
  语言是安全 Lua 子集，不是嵌入完整 Lua；设计契约与 oy-pixel 对齐。
- **真实素材导出**：透明 PNG、GIF89a、精灵表 + JSON atlas、OYPX v2 工程、
  manifest；独立 HTML viewer 可选。
- **绘画技巧约束**：注册 DSH 系统提示词段 `pixel-studio:craft`，把
  oy-pixel 的 `PIXEL_AGENT_INSTRUCTIONS` 工作流和 `PIXEL ART CRAFT` /
  `PIXEL ANIMATION CRAFT` 技巧注入每次生成。
- **Craft 报告**：自动检查对比度、孤立像素、循环缝、帧时长、颜色数量和
  剪影覆盖率，并写入工具结果与 manifest。
- **零运行时依赖**：Host 只用 Node 内置模块；Shader 在受限解释器中执行；
  Client 使用 DSH 自带的 React。
- **不访问网络**：只读写 Session 工作目录下的文件。

## 环境要求

- DeepSeek Harness **0.2.1-rc.2 或更高，0.2.x 范围内**
- Node.js **20+**（开发/测试）
- DSH Web GUI（Client 半侧声明为 `platform: "web"`）

## 安装

对 CLI 管理的 profile（把 `my-profile` 替换为实际名称，如 `web`、`headless`
或自定义 profile）：

```bash
# 1) 通过 SSH 安装到 profile
dsh plugin --profile my-profile add "git+ssh://git@github.com/Fantety/dsh-pixel-studio.git"

# 2) 在 profile 的 cordis.patch.yml 追加：
```

```yaml
- insert:
    - id: pixel-studio
      name: dsh-pixel-studio
```

`desktop` profile 由 Electron 管理，CLI 会拒绝 `dsh plugin --profile desktop`；
请使用 DSH 插件管理器或 Desktop 内置命令运行时安装，然后追加同样的 `insert`。

重新加载 profile，然后**刷新一次 Web 页面**以加载 Client bundle。刷新后工具卡片
仍是通用卡片时，重启一次 DSH。

本地开发：

```bash
cd ~/.dsh/profiles/my-profile
pnpm add "link:/absolute/path/to/dsh-pixel-studio"
```

## 使用

直接用自然语言：

> 画一个 32×32 的苔藓史莱姆，左上打光，做成 8 帧漂浮动画，导出 PNG、GIF 和 OYPX。

直接调用：

```json
{
  "name": "moss-slime",
  "template": "slime",
  "palette": "sweetie16",
  "effects": { "outline": true, "shadow": true },
  "outputDir": "pixel-art"
}
```

使用 `legend` 手绘：

```json
{
  "name": "tiny-heart",
  "legend": { "O": "#3B0D1A", "R": "#EF4B6B", "L": "#FF9FB2" },
  "grid": [
    ".OO..OO.",
    "ORROORRO",
    "ORLRRRRO",
    "ORRRRRRO",
    ".ORRRRO.",
    "..ORRO..",
    "...OO...",
    "........"
  ],
  "scale": 12
}
```

动画：

```json
{
  "name": "native-ghost",
  "template": "ghost",
  "palette": "sweetie16",
  "effects": { "shadow": true, "shadowColor": "#00000055" },
  "motion": { "preset": "float", "frames": 8, "amplitude": 1 },
  "fps": 12,
  "loop": 0,
  "scale": 10
}
```

## 程序化 shader

`pixel_shader` 对齐 oy-pixel `pixel_run_shader` 的设计：脚本在 Canvas 上绘制，
使用 `pal()`、`mix()`、`hsv()`、`alpha()`、`rand()`、`noise()`，通过
`time` / `phase` 采样动画帧。语言是受控 Lua 子集（不是完整 Lua）：

```json
{
  "name": "shader-horizon",
  "width": 32,
  "height": 32,
  "palette": "studio",
  "seed": 12,
  "code": "for y = 0, height - 1 do\n  local t = y / (height - 1)\n  for x = 0, width - 1 do canvas.pset(x, y, mix(hex('#0B1026'), hex('#FF8A5C'), t * t)) end\nend\ncanvas.circfill(width * 0.7, height * 0.72, 7, hex('#FFEC27'))"
}
```

支持 `local`、赋值、调用、`if/elseif/else`、数值 `for`、`while`、`break`、
表构造和 `[key]` 索引；Canvas API 包括 `pset/pget/line/rect/rectfill/
circle/circfill/ellipse/ellipsefill/flood/replace/outline/clear/stamp`。
没有文件系统、网络、`require` 或宿主全局，脚本受指令数、时间和像素修改预算限制。
完整 API 和与 oy-pixel 的设计映射见 [docs/SHADER.md](docs/SHADER.md)。

## 输出

```text
pixel-art/
  moss-slime.png                 透明 PNG
  moss-slime-preview.png         最近邻棋盘格预览
  moss-slime.gif                 动画 GIF
  moss-slime-sheet.png           精灵表
  moss-slime-sheet.json          帧图集
  moss-slime.oypx                oy-pixel v2 工程
  moss-slime.json                资源清单 + craft 报告
  moss-slime-viewer.html         可选：includeViewer: true
```

内嵌 Canvas 预算：**131,072 像素 / 4,096 色**（超过 64 色时每像素使用两个符号），
超限时退回为打开文件的紧凑面板。
GIF 透明度为 1-bit，时间粒度为 10 ms。OYPX 最多 256 色。

## 开发与测试

```bash
git clone git@github.com:Fantety/dsh-pixel-studio.git
cd dsh-pixel-studio
npm test
npm run check
npm run demo
npm run demo:showcase
npm run demo:shader
```

代码结构：

```text
lib/
  index.js            Host 入口
  plugin.js           DSH 工具注册、参数校验、内嵌画布
  craft-prompt.js     oy-pixel 工作流 + 绘画技巧系统提示词段
  client.js           Client 工具视图
  pixel/              渲染、编码、导出、craft 检查
  pixel/shader.js     程序化 shader 运行时 + Canvas API
  pixel/lua/          Lua 子集 lexer/parser/interpreter
scripts/              示例生成脚本
test/                 Node 测试
examples/             生成结果示例
docs/                 架构说明
```

## 许可证与致谢

本项目使用 [MIT License](LICENSE)，与 DeepSeek Harness 的许可证一致。

绘画技巧文本改编自 [oy-pixel](https://github.com/Fantety/oy-pixel)
（Copyright © 2026 Fantety）。详见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
