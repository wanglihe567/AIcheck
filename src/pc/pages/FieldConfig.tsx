import { useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table,
  Tabs, Tag, Upload, message,
} from 'antd'
import {
  CameraOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import {
  CARRIERS, CARRIER_NAME, MATCH_TYPES, addMaterialField, deleteMaterialField,
  errMsg, getMaterialFields, scanMaterialFields, updateMaterialField,
} from '../api'
import { useAuth } from '../auth'

interface MatField {
  id: number
  carrier_type: string
  field_key: string
  field_label: string
  match_type: string
  is_list: boolean
  source: string
  sort_order: number
}

const MATCH_NAME: Record<string, string> = Object.fromEntries(MATCH_TYPES.map((m) => [m.code, m.name]))
const SOURCE_META: Record<string, { color: string; text: string }> = {
  seed: { color: 'blue', text: '内置' },
  manual: { color: 'green', text: '手动录入' },
  ai: { color: 'purple', text: '图片学习' },
}

export default function FieldConfig() {
  const { can } = useAuth()
  const writable = can('config:manage')
  const [fields, setFields] = useState<Record<string, MatField[]>>({})
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState('seal_sticker')
  const [editing, setEditing] = useState<MatField | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getMaterialFields()
      setFields(data.fields)
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ match_type: 'exact', is_list: false })
    setModalOpen(true)
  }
  const openEdit = (f: MatField) => {
    setEditing(f)
    form.setFieldsValue({ field_label: f.field_label, match_type: f.match_type, is_list: f.is_list })
    setModalOpen(true)
  }
  const submitField = async () => {
    const v = await form.validateFields()
    try {
      if (editing) {
        await updateMaterialField(editing.id, v)
        message.success('字段已更新')
      } else {
        await addMaterialField({ carrier_type: active, ...v })
        message.success(`字段「${v.field_label}」已添加`)
      }
      setModalOpen(false)
      load()
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  const onScan = async (file: File) => {
    setScanning(true)
    try {
      const res = await scanMaterialFields(active, file)
      setScanResult(res)
      message.success(`识别到 ${res.detected.length} 个字段，新增 ${res.added.length} 个`)
      load()
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setScanning(false)
    }
    return false
  }

  const onDelete = async (f: MatField) => {
    try {
      await deleteMaterialField(f.id)
      message.success('字段已删除')
      load()
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  const columns = [
    { title: '字段名称（印刷名）', dataIndex: 'field_label', render: (v: string, r: MatField) => (
      <Space>
        <b>{v}</b>
        {r.is_list && <Tag color="orange">多值列</Tag>}
      </Space>
    ) },
    { title: '匹配方式', dataIndex: 'match_type', width: 110, render: (v: string) => MATCH_NAME[v] || v },
    { title: '来源', dataIndex: 'source', width: 110, render: (v: string) => {
      const m = SOURCE_META[v] || { color: 'default', text: v }
      return <Tag color={m.color}>{m.text}</Tag>
    } },
    { title: '操作', width: 140, render: (_: any, r: MatField) => writable && (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        <Popconfirm title="确认删除该字段？" onConfirm={() => onDelete(r)}>
          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    ) },
  ]

  return (
    <div>
      <Card
        title="物料字段库配置"
        extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="字段库维护每种物料所有系列可能出现的印刷字段名"
          description="封口贴 / 铝箔 / 包装盒不同系列的字段名称可能不同：可上传该物料照片让 AI 识别印刷字段名（自动去重后入库），也可手动录入。任务单与厂商代码字段相对固定，已内置常用字段。字段用于「数据核对组」中配置跨物料比对关系。"
        />
        <Tabs
          activeKey={active}
          onChange={setActive}
          items={CARRIERS.map((c) => ({
            key: c.code,
            label: c.name,
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  {writable && (
                    <>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                        手动录入字段
                      </Button>
                      <Upload accept="image/*" showUploadList={false} beforeUpload={onScan}>
                        <Button icon={<CameraOutlined />} loading={scanning}>
                          上传图片识别字段
                        </Button>
                      </Upload>
                    </>
                  )}
                  <span style={{ color: '#999' }}>
                    共 {(fields[c.code] || []).length} 个字段
                    {c.code === 'task_order' && '（生产批号为多值列）'}
                    {c.code === 'vendor_code' && '（GTIN码为多值列）'}
                  </span>
                </Space>
                <Table
                  rowKey="id"
                  size="small"
                  loading={loading}
                  columns={columns as any}
                  dataSource={fields[c.code] || []}
                  pagination={false}
                />
              </div>
            ),
          }))}
        />
      </Card>

      <Modal
        title={editing ? `编辑字段：${editing.field_label}` : `新增字段 - ${CARRIER_NAME[active]}`}
        open={modalOpen}
        onOk={submitField}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="field_label" label="字段名称（按印刷名，如 系列名称 / Name / 含水量）" rules={[{ required: true }]}>
            <Input placeholder="例如：系列名称" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="match_type" label="匹配方式" rules={[{ required: true }]}>
                <Select options={MATCH_TYPES.map((m) => ({ value: m.code, label: m.name }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="is_list" label="多值列" valuePropName="checked">
                <Select
                  options={[
                    { value: false, label: '单值字段' },
                    { value: true, label: '多值列（批号/GTIN列）' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="图片字段识别结果"
        open={!!scanResult}
        onCancel={() => setScanResult(null)}
        onOk={() => setScanResult(null)}
        footer={<Button type="primary" onClick={() => setScanResult(null)}>知道了</Button>}
      >
        {scanResult && (
          <div>
            <p>
              物料：<b>{CARRIER_NAME[scanResult.carrier_type]}</b>，
              共识别到 <b>{scanResult.detected.length}</b> 个印刷字段名
            </p>
            <p style={{ color: '#52c41a' }}>新增入库 {scanResult.added.length} 个：</p>
            <Space wrap style={{ marginBottom: 12 }}>
              {scanResult.added.length ? scanResult.added.map((x: string) => <Tag key={x} color="green">{x}</Tag>) : <span style={{ color: '#999' }}>无</span>}
            </Space>
            <p style={{ color: '#faad14' }}>与已有字段重复 {scanResult.duplicated.length} 个（已自动去重）：</p>
            <Space wrap>
              {scanResult.duplicated.length ? scanResult.duplicated.map((x: string) => <Tag key={x} color="orange">{x}</Tag>) : <span style={{ color: '#999' }}>无</span>}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )
}
