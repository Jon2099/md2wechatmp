import { Menu, type MenuItemConstructorOptions } from 'electron'
import { CHANNELS } from '@shared/contracts/ipc'
import { emitToRenderer } from './ipc/register'

export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const send = (action: string) => {
    emitToRenderer(CHANNELS.menuAction, action)
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: '文件 (&F)',
      submenu: [
        {
          label: '新建 (&N)',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('file:new'),
        },
        {
          label: '打开... (&O)',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('file:open'),
        },
        { type: 'separator' },
        {
          label: '保存 (&S)',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('file:save'),
        },
        {
          label: '另存为... (&A)',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('file:save-as'),
        },
        {
          label: '自动保存',
          click: () => send('file:toggle-autosave'),
        },
        { type: 'separator' },
        {
          label: '导出 HTML... (&E)',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send('file:export-html'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const, label: '退出 (&X)' },
      ],
    },
    {
      label: '编辑 (&E)',
      submenu: [
        { role: 'undo' as const, label: '撤销' },
        { role: 'redo' as const, label: '重做' },
        { type: 'separator' },
        { role: 'cut' as const, label: '剪切' },
        { role: 'copy' as const, label: '复制' },
        { role: 'paste' as const, label: '粘贴' },
        { role: 'selectAll' as const, label: '全选' },
        { type: 'separator' },
        {
          label: '重新转换 (&R)',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => send('edit:recompile'),
        },
        {
          label: '复制到微信 (&C)',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => send('edit:copy-wechat'),
        },
      ],
    },
    {
      label: '视图 (&V)',
      submenu: [
        {
          label: '预览宽度',
          submenu: [
            {
              label: '小屏 (320px)',
              click: () => send('view:preview-width:320'),
            },
            {
              label: '标准 (375px)',
              click: () => send('view:preview-width:375'),
            },
            {
              label: '大屏 (430px)',
              click: () => send('view:preview-width:430'),
            },
          ],
        },
        { type: 'separator' },
        { role: 'togglefullscreen' as const, label: '切换全屏' },
        { role: 'toggleDevTools' as const, label: '开发者工具' },
      ],
    },
    {
      label: '主题 (&T)',
      submenu: [
        {
          label: '选择排版主题... (&P)',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => send('theme:open-modal'),
        },
        { type: 'separator' },
        {
          label: '深海蓝 (Ocean Blue)',
          click: () => send('theme:select:ocean-blue'),
        },
        {
          label: '石墨黑 (Graphite)',
          click: () => send('theme:select:graphite'),
        },
        {
          label: '呢陶 (Terracotta)',
          click: () => send('theme:select:terracotta'),
        },
        {
          label: '青绿 (Jade)',
          click: () => send('theme:select:jade'),
        },
        {
          label: '杂志 (Magazine)',
          click: () => send('theme:select:magazine'),
        },
        {
          label: '琥珀 (Amber)',
          click: () => send('theme:select:amber'),
        },
        {
          label: '暮紫 (Violet)',
          click: () => send('theme:select:violet'),
        },
        {
          label: '玄青 (Ink)',
          click: () => send('theme:select:ink'),
        },
      ],
    },
    {
      label: '选项 (&O)',
      submenu: [
        {
          label: '排版输出选项... (&S)',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('options:open-settings'),
        },
        {
          label: '转换诊断详情... (&D)',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => send('options:open-diagnostics'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
