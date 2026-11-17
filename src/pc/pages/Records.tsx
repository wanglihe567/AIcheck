import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Descriptions, Drawer, Empty, Image, Row,
  Select, Space, Statistic, Table, Tag, Timeline, Typography,
} from 'antd'
import { ReloadOutlined, MessageOutlined } from '@ant-design/icons'
import { getBatch, getStats, listBatches } from '../api'
import { conclusionTag, statusTag } from '../App'

const { Text } = Typography

const CARRIER_CN: Record<string, string> = {
  task_order: '任务单', vendor_code: '厂商代码', materials: '物料照片',
}

export default function Records() {
  const nav = useNavigate()
  const [data, setData] = useState<{ total: number; items: any[] }>({ total: 0, items: [] })
  const [stats, setStats] = useState<any>(null)
  const [status, setStatus] = useState<string>()
  const [detail, setDetail] = useState<any>(null)

  const load = async () => {
    setData(await listBatches({ status, page: 1, size: 50 }))
    setStats(await getStats())
  }
  useEffect(() => { load() }, [status])

  const columns = [
    { title: '批次号', dataIndex: 'code', render: (v: string, r: any) => <a onClick={() => setDetail(r)}>{v}</a> },
    { title: '数据核对组', dataIndex: 'group_name', render: (v: string) => <Tag color="blue">{v || '—'}</Tag> },
    { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color={statusTag(s).color}>{statusTag(s).text}</Tag> },
    { title: '结论', dataIndex: 'conclusion', render: (c: string) => c ? <Tag color={conclusionTag(c).color}>{conclusionTag(c).text}</Tag> : '—' },
    { title: '生产批号', dataIndex: 'target_lot', render: (v: string) => v || '—' },
    { title: 'GTIN', dataIndex: 'target_gtin', render: (v: string) => v || '—' },
    { title: '轮次', dataIndex: 'last_round', width: 70, render: (n: number) => n || 0 },
    { title: '创建人', dataIndex: 'creator' },
    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v?.replace('T', ' ').slice(0, 19) },
    {
      title: '操作', width: 170,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button
            size="small" type="primary" ghost icon={<MessageOutlined />}
            onClick={() => nav(`/chat/${r.id}`)}
          >
            {r.status === 'closed' ? '查看会话' : '继续核验'}
          </Button>
          <Button size="small" onClick={() => setDetail(r)}>详情</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card><Statistic title="批次总数" value={stats.total} /></Card></Col>
          <Col span={4}><Card><Statistic title="今日新增" value={stats.today} /></Card></Col>
          <Col span={4}><Card><Statistic title="通过(解锁)" value={stats.passed} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="异常锁定" value={stats.locked} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="整改复检中" value={stats.rechecking} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="未处理告警" value={stats.open_alerts} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>
      )}
      <Card
        title="核验记录（数据核对批次）"
        extra={
          <Space>
            <Select
              allowClear placeholder="按状态筛选" style={{ width: 160 }}
              value={status} onChange={setStatus}
              options={[
                { value: 'ready', label: '待核验' },
                { value: 'passed', label: '通过(解锁)' }, { value: 'locked', label: '异常锁定' },
                { value: 'rechecking', label: '整改复检中' }, { value: 'closed', label: '已关闭' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          </Space>
        }
      >
        <Table rowKey="id" columns={columns as any} dataSource={data.items}
          pagination={{ total: data.total, pageSize: 20 }} />
      </Card>

      <Drawer width={960} open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `核验批次 ${detail.code}（${detail.group_name || ''}）` : ''}>
        {detail && <Detail id={detail.id} onChat={() => nav(`/chat/${detail.id}`)} />}
      </Drawer>
    </div>
  )
}

function BaselineFields({ title, fields }: { title: string; fields: any }) {
  const entries = Object.entries(fields || {})
  return (
    <Card size="small" type="inner" title={title} style={{ marginBottom: 8 }}>
      {entries.length === 0 ? (
        <Text type="secondary">无基线数据</Text>
      ) : (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ fontSize: 13 }}>
              <Text type="secondary">{k}：</Text>
              <Text strong style={{ whiteSpace: 'pre-wrap' }}>
                {Array.isArray(v) ? v.join('、') : (v === null || v === undefined || v === '') ? '—' : String(v)}
              </Text>
            </div>
          ))}
        </Space>
      )}
    </Card>
  )
}

function Detail({ id, onChat }: { id: number; onChat: () => void }) {
  const [d, setD] = useState<any>(null)
  useEffect(() => { getBatch(id).then(setD) }, [id])

  if (!d) return null
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Button type="primary" ghost icon={<MessageOutlined />} onClick={onChat}>
        进入 AI 核验会话
      </Button>

      <Descriptions bordered size="small" column={2}
        items={[
          { key: 'g', label: '数据核对组', children: <Tag color="blue">{d.group_name}</Tag> },
          { key: 's', label: '状态', children: <Tag color={statusTag(d.status).color}>{statusTag(d.status).text}</Tag> },
          { key: 'c', label: '结论', children: d.conclusion ? <Tag color={conclusionTag(d.conclusion).color}>{conclusionTag(d.conclusion).text}</Tag> : '—' },
          { key: 'r', label: '核验轮次', children: d.last_round },
          { key: 'lot', label: '本次核验批号', children: d.target_lot || '—' },
          { key: 'gtin', label: '本次核验GTIN', children: d.target_gtin || '—' },
          { key: 'f', label: '异常原因', span: 2, children: <Text type="danger">{d.fail_reason || '—'}</Text> },
        ]}
      />

      <div>
        <BaselineFields title="生产任务单（基线）" fields={d.baseline?.task_order} />
        <BaselineFields title="厂商代码（基线）" fields={d.baseline?.vendor_code} />
      </div>

      {d.comparisons?.length > 0 && (
        <Card size="small" type="inner" title={`第 ${d.last_round} 轮逐行比对结果`}>
          <Table
            rowKey="id" size="small" pagination={false}
            dataSource={d.comparisons}
            columns={[
              { title: '行号', dataIndex: 'row_no', width: 64, render: (n: number) => <Tag>第{n}行</Tag> },
              { title: '比对字段', dataIndex: 'field_label', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              {
                title: '结果', dataIndex: 'result', width: 90,
                render: (r: string) => <Tag color={r === 'pass' ? 'success' : r === 'fail' ? 'error' : 'default'}>
                  {r === 'pass' ? '一致' : r === 'fail' ? '不一致' : '未比对'}
                </Tag>,
              },
              { title: '说明', dataIndex: 'remark', render: (v: string, r: any) => (
                <Text type={r.result === 'fail' ? 'danger' : undefined} style={{ fontSize: 12 }}>{v}</Text>
              ) },
            ]}
          />
        </Card>
      )}

      {d.alerts?.length > 0 && (
        <Card size="small" type="inner" title="告警">
          <Timeline
            items={d.alerts.map((a: any) => ({
              color: a.status === 'open' ? 'red' : 'green',
              children: <span>[{a.status === 'open' ? '未处理' : '已关闭'}] {a.message} <Text type="secondary">{a.created_at?.replace('T', ' ').slice(0, 19)}</Text></span>,
            }))}
          />
        </Card>
      )}

      {d.reworks?.length > 0 && (
        <Card size="small" type="inner" title="整改记录">
          <Timeline
            items={d.reworks.map((r: any) => ({
              color: 'blue',
              children: <span>第{r.round_no}轮后整改：<Text type="danger">{r.reason}</Text> → {r.action}</span>,
            }))}
          />
        </Card>
      )}

      <Card size="small" type="inner" title="上传照片（审计留痕）">
        <Space wrap>
          {d.images?.map((i: any) => (
            <div key={i.id}>
              <Image src={i.url} width={160} height={160}
                style={{ objectFit: 'cover', border: '1px solid #eee', borderRadius: 8 }} />
              <div style={{ textAlign: 'center' }}>
                <Tag>{CARRIER_CN[i.carrier_type] || i.carrier_type}{i.round_no ? `（第${i.round_no}轮）` : '（基线）'}</Tag>
              </div>
            </div>
          ))}
          {(!d.images || d.images.length === 0) && <Empty description="无照片" />}
        </Space>
      </Card>
    </Space>
  )
}
