import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { login, errMsg } from '../api'
import { useAuth } from '../auth'

export default function Login() {
  const { setUser } = useAuth()
  const nav = useNavigate()

  const onFinish = async (v: { username: string; password: string }) => {
    try {
      const data = await login(v.username, v.password)
      localStorage.setItem('token', data.access_token)
      setUser(data.user)
      message.success(`欢迎，${data.user.real_name || data.user.username}`)
      nav('/')
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          外包装信息一致性 AI 核验系统
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          封口贴 / 铝箔 / 包装盒 / 生产任务单 / 厂商代码
        </Typography.Paragraph>
        <Form onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="admin / inspector / manager" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password placeholder="admin123 / inspect123 / manager123" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
