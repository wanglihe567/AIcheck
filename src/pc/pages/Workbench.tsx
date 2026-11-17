import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Empty, Form, Image, Input, Row, Select, Space, Spin, Steps,
  Table, Tag, Typography, message,
} from 'antd'
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, CloudUploadOutlined,
  EditOutlined, MessageOutlined, PlusOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons'
import {
  createBatch, editBaseline, errMsg, getGroup, getTargetOptions, listBatches,
  listGroups, uploadBaseline,
} from '../api'
import { useAuth } from '../auth'
import { statusTag } from '../App'

const { Text } = Typography

interface GroupBrief {
  id: number
  name: string
  remark?: string
  row_count: number
  batch_count: number
}

interface FieldMeta {
  label: string
  is_list: boolean
}

/** 从核对组行中提取某载体参与比对的字段（按行序去重）。 */
function carrierFields(rows: any[], carrier: string): FieldMeta[] {
  const out: FieldMeta[] = []
  const seen = new Set<string>()
  for (const r of rows || []) {
    const meta = r.cells?.[carrier]
    if (meta?.label && !seen.has(meta.label)) {
      seen.add(meta.label)
      out.push({ label: meta.label, is_list: !!meta.is_list })
    }
  }
  return out
}

export default function Workbench() {
  const nav = useNavigate()
  const { can } = useAuth()
  const [step, setStep] = useState(0)
  const [groups, setGroups] = useState<GroupBrief[]>([])
  const [groupId, setGroupId] = useState<number | null>(null)
  const [group, setGroup] = useState<any>(null)
  const [openBatches, setOpenBatches] = useState<any[]>([])
  // 本次进入工作台的基线：不复用服务端存量数据，必须重新上传识别
  const [baseline, setBaseline] = useState<any>({ task_order: null, vendor_code: null, check: null })

  useEffect(() => {
    listGroups().then((d) => {
      setGroups(d.items || [])
      if (d.items?.length) setGroupId(d.items[0].id)
    }).catch((e) => message.error(errMsg(e)))
    listBatches({ size: 100 }).then((d) =>
      setOpenBatches((d.items || []).filter((b: any) => b.status !== 'closed')),
    ).catch(() => {})
  }, [])

  const loadGroup = async (id: number) => {
    const g = await getGroup(id)
    setGroup(g)
    // 忽略服务端已有的基线，强制走「重新上传」流程
    setBaseline({ task_order: null, vendor_code: null, check: null })
    return g
  }

  // 重新上传/修正后，只同步本次上传的那个载体，并带上最新交叉校验结果
  const refreshBaseline = async (carrier: 'task_order' | 'vendor_code') => {
    if (!group) return
    const g = await getGroup(group.id)
    setGroup(g)
    setBaseline((prev: any) => ({
      ...prev,
      [carrier]: g.baseline?.[carrier] ?? null,
      check: g.baseline?.check ?? null,
    }))
  }

  // 刷新：只刷新本次已重新上传过的载体，未上传的仍保持空白
  const reloadSessionBaseline = async () => {
    if (!group) return
    const g = await getGroup(group.id)
    setGroup(g)
    setBaseline((prev: any) => ({
      task_order: prev.task_order ? (g.baseline?.task_order ?? null) : null,
      vendor_code: prev.vendor_code ? (g.baseline?.vendor_code ?? null) : null,
      check: prev.task_order || prev.vendor_code ? (g.baseline?.check ?? null) : null,
    }))
  }

  useEffect(() => {
    if (groupId) loadGroup(groupId).catch((e) => message.error(errMsg(e)))
    else {
      setGroup(null)
      setBaseline({ task_order: null, vendor_code: null, check: null })
    }
  }, [groupId])

  const baselineReady = !!baseline?.task_order && !!baseline?.vendor_code && !!baseline?.check?.ok
  const resumeBatches = openBatches.filter((b) => b.group_id === groupId)

  const selectGroup = (id: number) => {
    setGroupId(id)
    setStep(0)
  }

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 12 } }} style={{ marginBottom: 16 }}>
        <Steps
          current={step}
          onChange={(s) => {
            if (s === 0 || (s === 1 && groupId) || (s === 2 && baselineReady)) setStep(s)
          }}
          items={[
            { title: '选择数据核对组' },
            { title: '初始化任务单 / 厂商代码' },
            { title: '创建核验批次' },
          ]}
        />
      </Card>

      {step === 0 && (
        <Card title="第一步：选择数据核对组">
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="数据核对组定义了五种载体（封口贴 / 铝箔 / 包装盒 / 任务单 / 厂商代码）之间的字段比对关系"
            description="选择一个核对组后，任务单与厂商代码只需识别该组涉及的字段；AI 核验时以「行」为单位逐行比对。若还没有核对组，可先到「数据核对组」菜单创建。"
          />
          {groups.length === 0 ? (
            <Empty description="暂无数据核对组">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/groups')}>去创建核对组</Button>
            </Empty>
          ) : (
            <Row gutter={[12, 12]}>
              {groups.map((g) => (
                <Col span={8} key={g.id}>
                  <Card
                    size="small" hoverable
                    onClick={() => selectGroup(g.id)}
                    style={{
                      borderColor: g.id === groupId ? '#1677ff' : undefined,
                      borderWidth: g.id === groupId ? 2 : 1,
                      background: g.id === groupId ? '#e6f4ff' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {g.id === groupId && <CheckCircleOutlined style={{ color: '#1677ff', marginRight: 6 }} />}
                          {g.name}
                        </div>
                        {g.remark && <Text type="secondary" style={{ fontSize: 12 }}>{g.remark}</Text>}
                        <div style={{ marginTop: 6 }}>
                          <Tag style={{ marginInlineEnd: 4 }}>{g.row_count} 行比对</Tag>
                          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{g.batch_count} 个批次</Tag>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {resumeBatches.length > 0 && (
            <Card size="small" type="inner" title="该核对组进行中的批次（可直接回到聊天页继续核验）" style={{ marginTop: 16 }}>
              <Space wrap>
                {resumeBatches.map((b) => (
                  <Card key={b.id} size="small" styles={{ body: { padding: 10 } }} style={{ minWidth: 260 }}>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{b.code}</Text>
                        <Tag color={statusTag(b.status).color}>{statusTag(b.status).text}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        批号 {b.target_lot || '—'}{b.target_gtin ? ` / GTIN ${b.target_gtin}` : ''} · 第 {b.last_round} 轮
                      </Text>
                      <Button type="link" size="small" icon={<MessageOutlined />}
                        style={{ padding: 0 }} onClick={() => nav(`/chat/${b.id}`)}>
                        继续核验
                      </Button>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => nav('/groups')}>管理核对组</Button>
              <Button type="primary" icon={<ArrowRightOutlined />} disabled={!groupId}
                onClick={() => setStep(1)}>
                下一步：初始化基线
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {step === 1 && group && (
        <StepBaseline
          group={group}
          baseline={baseline}
          onReload={refreshBaseline}
          onRefresh={reloadSessionBaseline}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          canEdit={can('baseline:manage')}
        />
      )}

      {step === 2 && group && (
        <StepCreateBatch
          group={group}
          onBack={() => setStep(1)}
          onCreated={(id: number) => nav(`/chat/${id}`)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 第二步：基线初始化

function StepBaseline({ group, baseline, onReload, onRefresh, onBack, onNext, canEdit }: {
  group: any
  baseline: any
  onReload: (carrier: 'task_order' | 'vendor_code') => void
  onRefresh: () => void
  onBack: () => void
  onNext: () => void
  canEdit: boolean
}) {
  const check = baseline?.check
  const toFields = useMemo(() => carrierFields(group.rows, 'task_order'), [group])
  const vcFields = useMemo(() => carrierFields(group.rows, 'vendor_code'), [group])
  const bothUploaded = !!baseline?.task_order && !!baseline?.vendor_code
  const ready = bothUploaded && !!check?.ok

  return (
    <div>
      <Alert
        type="warning" showIcon style={{ marginBottom: 16 }}
        message="每次进入核验工作台都需要重新上传任务单与厂商代码照片，系统不复用历史基线数据。"
      />
      <Row gutter={16}>
        <Col span={12}>
          <BaselineCard
            title="生产任务单（基线）"
            carrier="task_order"
            groupId={group.id}
            fields={toFields}
            data={baseline?.task_order}
            canEdit={canEdit}
            onChanged={() => onReload('task_order')}
          />
        </Col>
        <Col span={12}>
          <BaselineCard
            title="厂商代码（基线）"
            carrier="vendor_code"
            groupId={group.id}
            fields={vcFields}
            data={baseline?.vendor_code}
            canEdit={canEdit}
            onChanged={() => onReload('vendor_code')}
          />
        </Col>
      </Row>

      {bothUploaded && (
        <Card size="small" type="inner" title="任务单 × 厂商代码 交叉校验" style={{ marginTop: 16 }}>
          {check?.ok ? (
            <Alert
              type="success" showIcon
              message="交叉校验通过：任务单与厂商代码中需互相比对的字段全部一致，可以创建核验批次"
            />
          ) : (
            <Alert
              type="error" showIcon
              message="交叉校验未通过：以下字段不一致，请核对照片或在上方人工修正基线后保存"
            />
          )}
          {check?.results?.length > 0 && (
            <Table
              style={{ marginTop: 12 }}
              rowKey="row_no"
              size="small"
              pagination={false}
              dataSource={check.results}
              columns={[
                { title: '行号', dataIndex: 'row_no', width: 64, render: (n: number) => <Tag>第 {n} 行</Tag> },
                { title: '比对字段', dataIndex: 'labels', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                {
                  title: '结果', dataIndex: 'result', width: 90,
                  render: (r: string) => (
                    <Tag color={r === 'pass' ? 'success' : r === 'fail' ? 'error' : 'default'}>
                      {r === 'pass' ? '一致' : r === 'fail' ? '不一致' : '未比对'}
                    </Tag>
                  ),
                },
                { title: '说明', dataIndex: 'remark', render: (v: string, r: any) => (
                  <Text type={r.result === 'fail' ? 'danger' : undefined} style={{ fontSize: 12 }}>{v}</Text>
                ) },
              ]}
            />
          )}
        </Card>
      )}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>上一步</Button>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
          <Button type="primary" icon={<ArrowRightOutlined />} disabled={!ready} onClick={onNext}>
            下一步：创建核验批次
          </Button>
        </Space>
      </div>
    </div>
  )
}

function BaselineCard({ title, carrier, groupId, fields, data, canEdit, onChanged }: {
  title: string
  carrier: string
  groupId: number
  fields: FieldMeta[]
  data: any
  canEdit: boolean
  onChanged: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  // 识别结果返回后，把字段值铺到可编辑表单（多值列每行一个）
  useEffect(() => {
    const f: Record<string, string> = {}
    for (const meta of fields) {
      const v = data?.fields?.[meta.label]
      f[meta.label] = Array.isArray(v) ? v.join('\n') : (v ?? '')
    }
    setForm(f)
    setEditing(false)
  }, [data, fields])

  const pickFile = () => fileRef.current?.click()

  const doUpload = async (file: File) => {
    setUploading(true)
    try {
      await uploadBaseline(groupId, carrier, file)
      message.success(`${title.replace('（基线）', '')}识别完成`)
      onChanged()
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const doSave = async () => {
    const payload: Record<string, any> = {}
    for (const meta of fields) {
      const raw = form[meta.label] ?? ''
      payload[meta.label] = meta.is_list
        ? raw.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean)
        : raw.trim()
    }
    setSaving(true)
    try {
      await editBaseline(groupId, carrier, payload)
      message.success('基线已保存，交叉校验已更新')
      onChanged()
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title={title}
      extra={
        data ? (
          <Space>
            {canEdit && (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing((v) => !v)}>
                  {editing ? '收起编辑' : '修正数据'}
                </Button>
                <Button size="small" icon={<CloudUploadOutlined />} loading={uploading} onClick={pickFile}>
                  重新上传
                </Button>
              </>
            )}
          </Space>
        ) : canEdit ? (
          <Button size="small" type="primary" icon={<CloudUploadOutlined />} loading={uploading} onClick={pickFile}>
            上传照片识别
          </Button>
        ) : null
      }
    >
      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f) }}
      />
      {!data ? (
        uploading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin tip="AI 正在识别照片，请稍候…" />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
            canEdit ? '上传照片后，AI 仅识别本核对组配置的字段' : '等待基线初始化'
          } />
        )
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space wrap>
            {data.image_url && (
              <Image src={data.image_url} width={96} height={96}
                style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
            )}
            <div>
              <Tag color="purple">AI：{data.provider}</Tag>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                识别时间：{data.created_at?.replace('T', ' ').slice(0, 19)}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                仅展示核对组配置的 {fields.length} 个字段
              </div>
            </div>
          </Space>

          {fields.map((meta) => (
            <div key={meta.label}>
              <div style={{ marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>{meta.label}</Text>
                {meta.is_list && <Tag color="orange" style={{ marginLeft: 6 }}>多值列</Tag>}
              </div>
              {editing && canEdit ? (
                meta.is_list ? (
                  <Input.TextArea
                    rows={3} placeholder={`每行一个值（如多个批号）`}
                    value={form[meta.label] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [meta.label]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={form[meta.label] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [meta.label]: e.target.value }))}
                  />
                )
              ) : (
                <div style={{
                  background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6,
                  padding: '6px 10px', minHeight: 32, fontSize: 13,
                  whiteSpace: meta.is_list ? 'pre-wrap' : 'normal',
                  color: (data.fields?.[meta.label] === undefined || data.fields?.[meta.label] === '') ? '#bbb' : undefined,
                }}>
                  {data.fields?.[meta.label] === undefined || data.fields?.[meta.label] === ''
                    ? '（未识别到，请人工修正或重新上传）'
                    : Array.isArray(data.fields[meta.label])
                      ? data.fields[meta.label].join('\n')
                      : String(data.fields[meta.label])}
                </div>
              )}
            </div>
          ))}

          {editing && canEdit && (
            <Button type="primary" block icon={<SaveOutlined />} loading={saving} onClick={doSave}>
              保存修正并重新交叉校验
            </Button>
          )}
        </Space>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- 第三步：创建批次

function StepCreateBatch({ group, onBack, onCreated }: {
  group: any
  onBack: () => void
  onCreated: (id: number) => void
}) {
  const [lots, setLots] = useState<string[]>([])
  const [gtins, setGtins] = useState<string[]>([])
  const [lot, setLot] = useState<string>()
  const [gtin, setGtin] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getTargetOptions(group.id).then((d) => {
      setLots(d.lots || [])
      setGtins(d.gtins || [])
    }).catch((e) => message.error(errMsg(e)))
  }, [group.id])

  const submit = async () => {
    if (!lot) {
      message.warning('请选择本次核验的生产批号')
      return
    }
    setSubmitting(true)
    try {
      const d = await createBatch({ group_id: group.id, target_lot: lot, target_gtin: gtin || undefined })
      message.success(`批次 ${d.code} 已就绪，进入 AI 核验会话`)
      onCreated(d.id)
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="第三步：创建数据核对批次">
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="批次按「生产批号 / GTIN」区分：同一核对组下，更换批号或 GTIN 即为新批次；同组同批号的未关闭批次会自动恢复，可随时退出后从工作台或核验记录回到聊天页继续。"
      />
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" type="inner" title="核验指针">
            <Form layout="vertical">
              <Form.Item label="本次核验生产批号（必选，来自任务单批号列）" required>
                <Select
                  showSearch placeholder="选择生产批号"
                  value={lot} onChange={setLot}
                  options={lots.map((x) => ({ value: x, label: x }))}
                  notFoundContent={lots.length === 0 ? '任务单中未识别到批号列' : undefined}
                />
              </Form.Item>
              <Form.Item label="本次核验 GTIN / GIN 码（可选，来自厂商代码 GTIN 列）">
                <Select
                  showSearch allowClear placeholder="选择 GTIN（可不选）"
                  value={gtin} onChange={setGtin}
                  options={gtins.map((x) => ({ value: x, label: x }))}
                  notFoundContent={gtins.length === 0 ? '厂商代码中未识别到 GTIN 列' : undefined}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" type="inner" title="核验前确认">
            <Space direction="vertical" size={6}>
              <div><Text type="secondary">核对组：</Text><Text strong>{group.name}</Text></div>
              <div><Text type="secondary">比对行数：</Text><Text strong>{group.row_count ?? group.rows?.length ?? 0} 行</Text></div>
              <div><Text type="secondary">任务单基线：</Text><Tag color="success">已识别</Tag></div>
              <div><Text type="secondary">厂商代码基线：</Text><Tag color="success">已识别</Tag></div>
              <div><Text type="secondary">交叉校验：</Text><Tag color="success">通过</Tag></div>
            </Space>
          </Card>
        </Col>
      </Row>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>上一步</Button>
          <Button type="primary" icon={<MessageOutlined />} loading={submitting} onClick={submit}>
            创建批次并进入 AI 核验
          </Button>
        </Space>
      </div>
    </Card>
  )
}
