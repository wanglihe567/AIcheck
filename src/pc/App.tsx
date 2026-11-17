import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Layout, Menu, Dropdown, Modal, Form, Input, message, Space, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './index.css'
import {
  ApartmentOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  KeyOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { AuthProvider, useAuth } from './auth'
import Login from './pages/Login'
import Workbench from './pages/Workbench'
import Records from './pages/Records'
import Groups from './pages/Groups'
import Chat from './pages/Chat'
import FieldConfig from './pages/FieldConfig'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import { changePassword, errMsg } from './api'

const { Sider, Header, Content } = Layout

const STATUS_META: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ready: { color: 'processing', text: '待核验' },
  passed: { color: 'success', text: '通过(解锁)' },
  locked: { color: 'error', text: '异常锁定' },
  rechecking: { color: 'warning', text: '整改复检中' },
  closed: { color: 'default', text: '已关闭' },
}
export const statusTag = (s: string) => STATUS_META[s] || { color: 'default', text: s }

const CONCLUSION_META: Record<string, { color: string; text: string }> = {
  pass: { color: 'success', text: '一致通过' },
  inconsistent: { color: 'error', text: '信息不一致' },
  recognition_failed: { color: 'warning', text: '识别失败' },
}
export const conclusionTag = (s: string) => CONCLUSION_META[s] || { color: 'default', text: s || '-' }

function Shell() {
  const { user, can, setUser } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  if (!user) return <Login />

  const menus = [
    can('batch:create') && { key: '/workbench', icon: <ExperimentOutlined />, label: '核验工作台' },
    can('batch:view') && { key: '/records', icon: <UnorderedListOutlined />, label: '核验记录' },
    can('config:view') && { key: '/groups', icon: <ApartmentOutlined />, label: '数据核对组' },
    can('config:view') && { key: '/config', icon: <SettingOutlined />, label: '字段配置' },
    can('user:view') && { key: '/users', icon: <TeamOutlined />, label: '用户权限' },
    can('audit:view') && { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
  ].filter(Boolean) as { key: string; icon: any; label: string }[]

  // 聊天页 /chat/:id 属于工作台流程，菜单高亮落在「核验工作台」
  const activeMenu = loc.pathname.startsWith('/chat/') ? '/workbench' : loc.pathname

  const doLogout = () => {
    setUser(null)
    nav('/login')
  }

  const pwdModal = () => {
    const [form] = Form.useForm()
    Modal.confirm({
      title: '修改密码',
      icon: <KeyOutlined />,
      content: (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="old_password" label="原密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const v = await form.validateFields()
        try {
          await changePassword(v.old_password, v.new_password)
          message.success('密码已修改')
        } catch (e) {
          message.error(errMsg(e))
          throw e
        }
      },
    })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, padding: '0 12px', textAlign: 'center' }}>
          外包装信息一致性
          <br />
          AI 核验系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeMenu]}
          items={menus}
          onClick={(e) => nav(e.key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingInline: 24 }}>
          <Typography.Text type="secondary">医疗器械外包量产现场 · 封口贴 / 铝箔 / 包装盒 / 任务单 / 厂商代码</Typography.Text>
          <Dropdown
            menu={{
              items: [
                { key: 'pwd', icon: <KeyOutlined />, label: '修改密码', onClick: pwdModal },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: doLogout },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              {user.real_name || user.username}（{user.role_name}）
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Routes>
            <Route path="/" element={<Navigate to={can('batch:create') ? '/workbench' : '/records'} />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/records" element={<Records />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/chat/:batchId" element={<Chat />} />
            <Route path="/config" element={<FieldConfig />} />
            <Route path="/users" element={<Users />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export { CheckCircleOutlined }
