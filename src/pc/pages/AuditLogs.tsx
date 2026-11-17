import { useEffect, useState } from 'react'
import { Button, Card, Input, Space, Table, Tag } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { listAuditLogs } from '../api'

const ACTION_COLORS: Record<string, string> = {
  batch_create: 'blue', baseline_upload: 'cyan', baseline_edit: 'orange',
  target_set: 'geekblue', image_upload: 'cyan', ai_recognize: 'purple',
  verify_pass: 'success', verify_fail: 'error', rework_submit: 'warning',
  batch_close: 'default', config_update: 'orange', config_reset: 'magenta',
  user_create: 'green', user_update: 'green', user_reset_password: 'gold',
}

export default function AuditLogs() {
  const [data, setData] = useState<{ total: number; items: any[] }>({ total: 0, items: [] })
  const [action, setAction] = useState('')

  const load = async () => setData(await listAuditLogs({ action, page: 1, size: 100 }))
  useEffect(() => { load() }, [])

  return (
    <Card
      title="审计日志（图片上传 / AI 解析 / 数据比对 / 人工修改 全程留痕）"
      extra={
        <Space>
          <Input
            placeholder="按动作筛选，如 verify"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onPressEnter={load}
            style={{ width: 200 }}
          />
          <Button icon={<SearchOutlined />} onClick={load}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        size="small"
        dataSource={data.items}
        pagination={{ total: data.total, pageSize: 30, showSizeChanger: false }}
        columns={[
          { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => v?.replace('T', ' ').slice(0, 19) },
          { title: '操作人', dataIndex: 'username', width: 120 },
          {
            title: '动作', dataIndex: 'action', width: 170,
            render: (a: string) => <Tag color={ACTION_COLORS[a] || 'default'}>{a}</Tag>,
          },
          { title: '对象', dataIndex: 'target', width: 160 },
          { title: '详情', dataIndex: 'detail' },
          { title: 'IP', dataIndex: 'ip', width: 130 },
        ]}
      />
    </Card>
  )
}
