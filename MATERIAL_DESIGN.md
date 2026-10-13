# Material Design 3 界面规范

本次重做范围：首页、登录、收银、制作清单、副屏、菜单编辑、确认弹窗、号码票据、提示消息。

依据 Google 官方规范：
- 颜色角色：https://m3.material.io/styles/color/roles
- 字体层级：https://m3.material.io/styles/typography/applying-type
- 按钮：https://m3.material.io/components/buttons/overview
- 卡片：https://m3.material.io/components/cards/overview
- 输入框：https://m3.material.io/components/text-fields/overview
- 弹窗：https://m3.material.io/components/dialogs/overview
- 筛选芯片：https://m3.material.io/components/chips/overview
- 分段按钮：https://m3.material.io/components/segmented-buttons/overview

使用 M3 浅色基线配色与语义颜色变量；文字使用 display/headline/title/body/label 层级；按钮使用 filled、tonal、outlined、text 层级；卡片 12px、弹窗 28px 圆角；交互控件提供至少 48px 触控高度、hover/pressed/focus/disabled 状态；输入框具有持续标签、填充背景、焦点指示；弹窗保留原生焦点约束与 Escape；提示消息使用 inverse surface。

采用自有 HTML/CSS 实现，不是 Google 官方组件库。中文使用本机无衬线字体，无外部字体或样式 CDN。副屏群峦仅为装饰插画，界面卡片改为实色 Material surface；副屏号码按远距离观看需求放大。

订单、价格、服务器和语音叫号逻辑保持不变。
