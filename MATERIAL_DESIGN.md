# Material Design 3

首页、收银台、制作端、登录和菜单设置改用 Google 官方 @material/web。按钮、筛选芯片、输入框、复选框、弹窗和涟漪采用官方默认样式与尺寸，未覆盖组件圆角。菜单与订单卡片采用 M3 的 12px 卡片形状。

主题由 Google @material/material-color-utilities 生成，种子 #c2d843，浅色 Tonal Spot。所有颜色通过语义角色统一。

控件打包在 material.js，主题在 theme.css；没有 Google Fonts、esm.run 或其他运行时 CDN 依赖。

副屏保持之前的群峦毛玻璃界面，由 display.css 单独控制；不加载黄绿色主题。订单数据库和语音模块保持原实现。

官方参考：
- https://github.com/material-components/material-web/blob/main/docs/quick-start.md
- https://github.com/material-components/material-web/blob/main/docs/components/dialog.md
- https://github.com/material-components/material-web/blob/main/docs/components/chip.md
- https://github.com/material-components/material-web/blob/main/docs/components/text-field.md
- https://github.com/material-foundation/material-color-utilities

组件版本及许可见 THIRD_PARTY_NOTICES.txt 和 MATERIAL_LICENSE.txt。
