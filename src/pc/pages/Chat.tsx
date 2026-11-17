import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Empty, Form, Image, Input, Modal, Popconfirm, Space, Spin, Tag,
  Typography, message,
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, CameraOutlined,
  FileDoneOutlined, LockOutlined, RobotOutlined, SendOutlined, ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { chatText, chatUpload, closeBatch, errMsg, getBatch, rework } from '../api'
import { useAuth } from '../auth'
import { conclusionTag, statusTag } from '../App'

const { Text, Paragraph } = Typography

const CARRIER_COLOR: Record<string, string> = {
  seal_sticker: 'geekblue',
  aluminum_foil: 'cyan',
  box: 'green',
  task_order: 'gold',
  vendor_code: 'purple',
}

export default function Chat() {
  const { batchId } = useParams()
  const nav = useNavigate()
  const { can } = useAuth()
  const id = Number(batchId)

  const [batch, setBatch] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [text, setText] = useState('')
  const [reworkOpen, setReworkOpen] = useState(false)
  const [reworkSaving, setReworkSaving] = useState(false)
  const [lockExpanded, setLockExpanded] = useState(false)
  const [reworkForm] = Form.useForm()
  const fileRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const load = async (silent = false) => {
    try {
      const d = await getBatch(id)
      setBatch(d)
      setNotFound(false)
    } catch (e) {
      if (!silent) {
        setNotFound(true)
        message.error(errMsg(e))
      }
    }
  }

  useEffect(() => { load() }, [id])

  // 新消息自动滚动到底部
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [batch?.messages?.length, processing])

  const pickImages = () => fileRef.current?.click()

  const doUpload = async (files: File[]) => {
    if (!files.length) return
    setProcessing(true)
    try {
      const d = await chatUpload(id, files)
      setBatch(d)
      if (d.conclusion === 'pass') message.success('本轮核验全部一致，批次已解锁')
      else if (d.conclusion === 'inconsistent') message.warning('发现不一致项，批次已锁定，请录入整改')
      else message.error('未能识别物料信息，请重新拍照上传')
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setProcessing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const sendText = async () => {
    const content = text.trim()
    if (!content) return
    setText('')
    setProcessing(true)
    try {
      await chatText(id, content)
      await load(true)
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setProcessing(false)
    }
  }

  const submitRework = async () => {
    const v = await reworkForm.validateFields()
    setReworkSaving(true)
    try {
      const d = await rework(id, v.reason, v.action)
      setBatch(d)
      setReworkOpen(false)
      reworkForm.resetFields()
      message.success('整改措施已记录，请上传照片复检')
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setReworkSaving(false)
    }
  }

  const doClose = async () => {
    try {
      const d = await closeBatch(id)
      setBatch(d)
      message.success('批次已关闭归档')
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  if (notFound) {
    return <Card><Empty description="批次不存在或无权访问">
      <Button type="primary" onClick={() => nav('/workbench')}>返回工作台</Button>
    </Empty></Card>
  }
  if (!batch) {
    return <Card style={{ textAlign: 'center', padding: 48 }}><Spin tip="加载核验会话…" /></Card>
  }

  const status = batch.status
  const canVerify = can('batch:verify')
  const canRework = can('batch:rework')
  const uploadDisabled = processing || status === 'locked' || status === 'closed' || !canVerify

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      {/* 头部：批次指针 */}
      <Card size="small" styles={{ body: { padding: '10px 16px' } }} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => nav('/records')}>
              核验记录
            </Button>
            <Text strong style={{ fontSize: 15 }}>{batch.code}</Text>
            <Tag color="blue">{batch.group_name}</Tag>
            <Tag color={statusTag(status).color}>{statusTag(status).text}</Tag>
            {batch.conclusion && <Tag color={conclusionTag(batch.conclusion).color}>{conclusionTag(batch.conclusion).text}</Tag>}
          </Space>
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 13 }}>
              当前指针：批号 <Text strong style={{ color: '#cf1322' }}>{batch.target_lot}</Text>
              {batch.target_gtin && <> / GTIN <Text strong style={{ color: '#cf1322' }}>{batch.target_gtin}</Text></>}
              {' '}· 已核验 {batch.last_round} 轮
            </Text>
            {status === 'locked' && canRework && (
              <Button danger type="primary" size="small" icon={<ToolOutlined />} onClick={() => setReworkOpen(true)}>
                录入整改
              </Button>
            )}
            {status === 'passed' && canVerify && (
              <Popconfirm title="确认本批次核验通过并关闭归档？" onConfirm={doClose}>
                <Button type="primary" size="small" icon={<FileDoneOutlined />}>关闭归档</Button>
              </Popconfirm>
            )}
            <Button size="small" onClick={() => nav('/workbench')}>新建批次</Button>
          </Space>
        </div>
      </Card>

      {/* 锁定提示条：默认收起，避免大段失败原因挤占会话区域 */}
      {status === 'locked' && (
        <Alert
          type="error" showIcon icon={<LockOutlined />} style={{ marginBottom: 12 }}
          message="批次已异常锁定"
          action={
            <Button type="link" size="small" onClick={() => setLockExpanded((prev) => !prev)}>
              {lockExpanded ? '收起详情' : '展开详情'}
            </Button>
          }
          description={
            lockExpanded ? (
              <Space direction="vertical" size={2}>
                <Text type="danger" style={{ fontSize: 13 }}>{batch.fail_reason}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请核对现场物料后{canRework ? '点击「录入整改」填写原因与整改措施，再上传照片复检' : '通知质量主管/检验员录入整改'}。
                </Text>
              </Space>
            ) : undefined
          }
        />
      )}

      {/* 消息流 */}
      <Card
        styles={{ body: { padding: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f5f7fa' }}>
          {(batch.messages || []).map((m: any) => <MessageBubble key={m.id} m={m} />)}
          {processing && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <Avatar role="assistant" />
              <div style={{
                background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Spin size="small" />
                <Text type="secondary">正在识别照片并按核对组逐行比对，请稍候…</Text>
              </div>
            </div>
          )}
        </div>

        {/* 输入栏 */}
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 16px', background: '#fff' }}>
          {status === 'closed' ? (
            <Alert type="info" showIcon message="本批次已关闭归档，可在核验记录中查看历史" />
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <input
                ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length) doUpload(files)
                }}
              />
              <Button
                size="large"
                type={uploadDisabled ? 'default' : 'primary'}
                ghost={!uploadDisabled}
                icon={<CameraOutlined />}
                disabled={uploadDisabled}
                onClick={pickImages}
                style={{ marginRight: 8 }}
              >
                上传三合一照片
              </Button>
              <Input
                size="large"
                placeholder={
                  status === 'locked'
                    ? '批次已锁定，请先录入整改措施…'
                    : '也可以输入文字询问核验助手，回车发送…'
                }
                value={text}
                disabled={processing}
                onChange={(e) => setText(e.target.value)}
                onPressEnter={sendText}
              />
              <Button size="large" type="primary" icon={<SendOutlined />} disabled={processing || !text.trim()}
                onClick={sendText} style={{ marginLeft: 8 }}>
                发送
              </Button>
            </Space.Compact>
          )}
          <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
            请拍摄【封口贴 + 铝箔 + 包装盒】同框照片上传（可多选）；AI 将自动识别二维码/条码并按核对组逐行比对，
            封口贴/铝箔批号须与任务单批号列一致，铝箔 GIN 码须在厂商代码 GTIN 列中。
          </div>
        </div>
      </Card>

      {/* 整改录入 */}
      <Modal
        title="录入异常整改措施"
        open={reworkOpen}
        onOk={submitRework}
        confirmLoading={reworkSaving}
        onCancel={() => setReworkOpen(false)}
        okText="提交并进入复检"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={reworkForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="异常原因" rules={[{ required: true, message: '请填写异常原因' }]}>
            <Input.TextArea rows={3} placeholder="例如：包装盒含水量印刷错误，现场物料为 38.5%，任务单为 38.0%" />
          </Form.Item>
          <Form.Item name="action" label="整改措施" rules={[{ required: true, message: '请填写整改措施' }]}>
            <Input.TextArea rows={3} placeholder="例如：已更换正确版本包装盒，重新拍照待复检" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- 消息渲染

function Avatar({ role }: { role: string }) {
  const style: React.CSSProperties = {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: '#fff',
  }
  if (role === 'assistant') {
    return <div style={{ ...style, background: 'linear-gradient(135deg,#1677ff,#722ed1)' }}><RobotOutlined /></div>
  }
  return <div style={{ ...style, background: '#52c41a' }}><UserOutlined /></div>
}

function MessageBubble({ m }: { m: any }) {
  const time = m.created_at?.replace('T', ' ').slice(11, 19)

  if (m.role === 'system') {
    return (
      <div style={{ textAlign: 'center', margin: '14px 0' }}>
        <Tag style={{ whiteSpace: 'pre-wrap', padding: '4px 12px', fontSize: 12, color: '#666', background: '#eee', border: 'none' }}>
          {m.content}
        </Tag>
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{time}</div>
      </div>
    )
  }

  const isUser = m.role === 'user'

  let body: React.ReactNode
  if (m.kind === 'image') {
    body = (
      <Image
        src={m.image_url || m.content}
        width={260}
        style={{ borderRadius: 10, border: '1px solid #e8e8e8', display: 'block' }}
      />
    )
  } else if (m.kind === 'result') {
    body = <ResultCard payload={m.payload} content={m.content} />
  } else {
    body = (
      <div style={{
        maxWidth: 560,
        background: isUser ? '#1677ff' : '#fff',
        color: isUser ? '#fff' : 'inherit',
        border: isUser ? 'none' : '1px solid #e8e8e8',
        borderRadius: 10, padding: '10px 14px',
        whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7,
      }}>
        {m.content}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <Avatar role={m.role} />
      <div style={{ maxWidth: '82%' }}>
        {body}
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {isUser ? '检验员' : '核验助手'} · {time}
        </div>
      </div>
    </div>
  )
}

function ResultCard({ payload, content }: { payload: any; content: string }) {
  const conclusion = payload?.conclusion
  const rows: any[] = payload?.rows || []
  const passCount = rows.filter((r) => r.result === 'pass').length
  const failCount = rows.filter((r) => r.result === 'fail').length
  const naCount = rows.filter((r) => r.result === 'na').length

  const head =
    conclusion === 'pass'
      ? { color: '#f6ffed', border: '#b7eb8f', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, title: `第 ${payload?.round} 轮核验：全部一致，批次已解锁 ✅` }
      : conclusion === 'inconsistent'
        ? { color: '#fff2f0', border: '#ffccc7', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />, title: `第 ${payload?.round} 轮核验：发现 ${failCount} 行不一致，批次已锁定 🔒` }
        : { color: '#fffbe6', border: '#ffe58f', icon: <CloseCircleOutlined style={{ color: '#faad14' }} />, title: `第 ${payload?.round} 轮核验：未能完成识别 ⚠️` }

  return (
    <div style={{
      maxWidth: 720, background: head.color, border: `1px solid ${head.border}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {head.icon}
        <Text strong>{head.title}</Text>
      </div>

      <Space wrap size={4} style={{ marginBottom: 8 }}>
        <Tag color="success">一致 {passCount} 行</Tag>
        {failCount > 0 && <Tag color="error">不一致 {failCount} 行</Tag>}
        {naCount > 0 && <Tag>未比对 {naCount} 行</Tag>}
        {payload?.recognized?.length > 0 && (
          <Tag color="blue">识别到：{payload.recognized.map((c: string) =>
            ({ seal_sticker: '封口贴', aluminum_foil: '铝箔', box: '包装盒' } as any)[c] || c).join('、')}</Tag>
        )}
        {payload?.qr_count > 0 && <Tag color="purple">二维码/条码 {payload.qr_count} 个</Tag>}
      </Space>

      {conclusion !== 'pass' && payload?.fail_msgs?.length > 0 && (
        <Alert
          type="error" showIcon style={{ marginBottom: 10, padding: '6px 10px' }}
          message={<Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{(payload.fail_msgs || []).join('\n')}</Paragraph>}
        />
      )}

      {rows.length > 0 && (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {rows.map((r) => <RowResult key={r.row_no} row={r} />)}
        </Space>
      )}

      {conclusion === 'pass' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          所有比对行均已通过，可点击右上角「关闭归档」结束本批次；如需再次确认也可继续上传照片。
        </Text>
      )}
      {conclusion === 'inconsistent' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          请核对现场物料，点击右上角「录入整改」后重新上传照片复检。
        </Text>
      )}
      {conclusion === 'recognition_failed' && (
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{content}</Text>
      )}
    </div>
  )
}

function RowResult({ row }: { row: any }) {
  const pass = row.result === 'pass'
  const na = row.result === 'na'
  const values: any[] = row.values || []
  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '1px solid #eee',
      borderLeft: `4px solid ${pass ? '#52c41a' : na ? '#d9d9d9' : '#ff4d4f'}`,
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Space size={6}>
          <Text strong style={{ fontSize: 13 }}>第 {row.row_no} 行</Text>
          <Tag color={pass ? 'success' : na ? 'default' : 'error'} style={{ marginInlineEnd: 0 }}>
            {pass ? '一致' : na ? '未比对' : '不一致'}
          </Tag>
        </Space>
        {!pass && !na && <Text type="danger" style={{ fontSize: 12 }}>{row.remark}</Text>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {values.map((v, i) => {
          const missing = !v.value
          return (
            <div key={i} style={{
              fontSize: 12, background: v.side === 'baseline' ? '#f0f5ff' : '#fafafa',
              border: '1px solid #f0f0f0', borderRadius: 6, padding: '3px 8px',
              opacity: missing ? 0.7 : 1,
            }}>
              <Tag color={CARRIER_COLOR[v.carrier] || 'default'} style={{ marginInlineEnd: 4, fontSize: 11 }}>
                {v.carrier_name}
              </Tag>
              <Text type="secondary">{v.label}：</Text>
              {missing ? (
                <Text type="danger">未识别</Text>
              ) : (
                <Text strong style={{ color: v.side === 'baseline' ? '#1d39c4' : undefined }}>
                  {v.value}
                </Text>
              )}
              {v.is_list && <Tag color="orange" style={{ marginInlineStart: 4, fontSize: 10 }}>列</Tag>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
