import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { createUser, errMsg, listRoles, listUsers, resetUserPassword, updateUser } from '../api'
import { useAuth } from '../auth'

export default function Users() {
  const { can } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<any | null>(null)
  const [createForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const canManage = can('user:manage')

  const load = async () => {
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()])
      setUsers(u)
      setRoles(r)
    } catch (e) {
      message.error(errMsg(e))
    }
  }
  useEffect(() => { load() }, [])

  return (
    <Card
      title="用户与权限管理"
      extra={canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建用户</Button>}
    >
      <Table
        rowKey="id"
        size="small"
        dataSource={users}
        pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'real_name', render: (v: string) => v || '—' },
          {
            title: '角色', dataIndex: 'role_id',
            render: (rid: number, r: any) => (
              <Select
                size="small" style={{ width: 150 }} disabled={!canManage}
                value={rid} options={roles.map((x) => ({ label: x.name, value: x.id }))}
                onChange={async (v) => {
                  try {
                    await updateUser(r.id, { role_id: v })
                    message.success('角色已更新')
                    load()
                  } catch (e) {
                    message.error(errMsg(e))
                  }
                }}
              />
            ),
          },
          {
            title: '权限', dataIndex: 'role',
            render: (_: any, r: any) => {
              const role = roles.find((x) => x.code === r.role)
              const perms = role?.permissions || []
              return perms.includes('*')
                ? <Tag color="red">全部权限</Tag>
                : <Space wrap>{perms.map((p: string) => <Tag key={p}>{p}</Tag>)}</Space>
            },
          },
          {
            title: '状态', dataIndex: 'is_active',
            render: (v: boolean, r: any) => (
              <Switch
                size="small" checkedChildren="启用" unCheckedChildren="停用"
                disabled={!canManage || r.username === 'admin'}
                checked={v}
                onChange={async (x) => {
                  try {
                    await updateUser(r.id, { is_active: x })
                    message.success('已更新')
                    load()
                  } catch (e) {
                    message.error(errMsg(e))
                  }
                }}
              />
            ),
          },
          {
            title: '操作',
            render: (_: any, r: any) => (
              <Space>
                {canManage && (
                  <Button size="small" onClick={() => { resetForm.resetFields(); setResetTarget(r) }}>
                    重置密码
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          try {
            const v = await createForm.validateFields()
            await createUser(v)
            message.success('用户已创建')
            setCreateOpen(false)
            createForm.resetFields()
            load()
          } catch (e: any) {
            if (e?.errorFields) return
            message.error(errMsg(e))
          }
        }}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="real_name" label="姓名"><Input autoComplete="off" /></Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, message: '请输入初始密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role_id" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roles.map((r) => ({ label: `${r.name}（${r.code}）`, value: r.id }))} placeholder="请选择角色" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resetTarget ? `重置 ${resetTarget.username} 的密码` : '重置密码'}
        open={!!resetTarget}
        onCancel={() => setResetTarget(null)}
        onOk={async () => {
          try {
            const v = await resetForm.validateFields()
            await resetUserPassword(resetTarget.id, v.new_password)
            message.success('密码已重置')
            setResetTarget(null)
          } catch (e: any) {
            if (e?.errorFields) return
            message.error(errMsg(e))
          }
        }}
      >
        <Form form={resetForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password autoComplete="new-password" placeholder="请输入新密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
