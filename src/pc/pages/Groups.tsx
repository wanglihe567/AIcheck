import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space,
  Table, Tag, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons'
import {
  CARRIERS, createGroup, deleteGroup, errMsg, getGroup, getMaterialFields,
  listGroups, saveGroupRows, updateGroup,
} from '../api'
import { useAuth } from '../auth'

interface MatField {
  id: number
  carrier_type: string
  field_label: string
  match_type: string
  is_list: boolean
  source: string
}

interface GroupItem {
  id: number
  name: string
  remark?: string
  row_count: number
  batch_count: number
  updated_at?: string
}

type RowCells = Record<string, number | null>

const EMPTY_ROW: RowCells = {
  seal_sticker: null, aluminum_foil: null, box: null, task_order: null, vendor_code: null,
}

export default function Groups() {
  const { can } = useAuth()
  const writable = can('config:manage')
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [fields, setFields] = useState<Record<string, MatField[]>>({})
  const [groupId, setGroupId] = useState<number | null>(null)
  const [rows, setRows] = useState<RowCells[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [metaModal, setMetaModal] = useState<{ mode: 'create' | 'edit'; id?: number } | null>(null)
  const [metaForm] = Form.useForm()

  const loadGroups = async (selectId?: number) => {
    try {
      const data = await listGroups()
      setGroups(data.items)
      const target = selectId ?? groupId ?? data.items[0]?.id
      if (target) {
        setGroupId(target)
        loadGroup(target)
      } else {
        setGroupId(null)
        setRows([])
      }
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  const loadGroup = async (id: number) => {
    setLoading(true)
    try {
      const g = await getGroup(id)
      const mapped: RowCells[] = (g.rows || []).map((r: any) => {
        const cells: RowCells = { ...EMPTY_ROW }
        for (const c of CARRIERS) {
          const meta = r.cells?.[c.code]
          if (meta) cells[c.code] = meta.field_id
        }
        return cells
      })
      setRows(mapped.length ? mapped : [{ ...EMPTY_ROW }])
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getMaterialFields().then((d) => setFields(d.fields)).catch((e) => message.error(errMsg(e)))
    loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fieldOptions = useMemo(() => {
    const m: Record<string, { value: number; label: string }[]> = {}
    for (const c of CARRIERS) {
      m[c.code] = (fields[c.code] || []).map((f) => ({
        value: f.id,
        label: f.is_list ? `${f.field_label}（多值列）` : f.field_label,
      }))
    }
    return m
  }, [fields])

  // 同一物料列中，已被其他行选用的字段：下拉中过滤掉（一个字段只能参与一行比对）
  const usedFieldsByCarrier = useMemo(() => {
    const m: Record<string, Set<number>> = {}
    for (const c of CARRIERS) {
      const s = new Set<number>()
      for (const r of rows) {
        const v = r[c.code]
        if (v) s.add(v as number)
      }
      m[c.code] = s
    }
    return m
  }, [rows])

  const setCell = (idx: number, carrier: string, val: number | null) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [carrier]: val } : r)))
  }
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }])
  const delRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx))

  const doSave = async () => {
    if (!groupId) return
    const payload = rows
      .map((r) => {
        const o: Record<string, number> = {}
        for (const c of CARRIERS) {
          if (r[c.code]) o[c.code] = r[c.code] as number
        }
        return o
      })
      .filter((o) => Object.keys(o).length > 0)
    const bad = payload.findIndex((o) => Object.keys(o).length === 1)
    if (bad >= 0) {
      message.error(`第 ${bad + 1} 行只选了 1 个物料字段，一行至少需要 2 个物料才能比对`)
      return
    }
    if (!payload.length) {
      message.error('请至少配置一行比对关系')
      return
    }
    setSaving(true)
    try {
      await saveGroupRows(groupId, payload)
      message.success(`核对组已保存（${payload.length} 行比对关系）`)
      loadGroups(groupId)
    } catch (e) {
      message.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const openMeta = (mode: 'create' | 'edit', g?: GroupItem) => {
    setMetaModal({ mode, id: g?.id })
    metaForm.resetFields()
    if (mode === 'edit' && g) metaForm.setFieldsValue({ name: g.name, remark: g.remark })
  }
  const submitMeta = async () => {
    const v = await metaForm.validateFields()
    try {
      if (metaModal?.mode === 'create') {
        const g = await createGroup(v)
        message.success('核对组已创建')
        setMetaModal(null)
        loadGroups(g.id)
      } else if (metaModal?.id) {
        await updateGroup(metaModal.id, v)
        message.success('核对组已更新')
        setMetaModal(null)
        loadGroups(metaModal.id)
      }
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  const doDelete = async (g: GroupItem) => {
    try {
      await deleteGroup(g.id)
      message.success('核对组已删除')
      if (groupId === g.id) setGroupId(null)
      loadGroups()
    } catch (e) {
      message.error(errMsg(e))
    }
  }

  const current = groups.find((g) => g.id === groupId)

  const columns = [
    {
      title: '序号', width: 64, align: 'center' as const,
      render: (_: any, __: any, idx: number) => idx + 1,
    },
    ...CARRIERS.map((c) => ({
      title: c.name,
      dataIndex: c.code,
      render: (_: any, __: any, idx: number) => {
        const currentVal = rows[idx]?.[c.code] ?? null
        const used = usedFieldsByCarrier[c.code]
        const options = (fieldOptions[c.code] || []).filter(
          (o) => o.value === currentVal || !used?.has(o.value),
        )
        return (
          <Select
            style={{ width: '100%' }}
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={options.length ? '选择字段' : '该物料字段已全部配置'}
            disabled={!writable}
            value={currentVal}
            options={options}
            onChange={(v) => setCell(idx, c.code, v ?? null)}
          />
        )
      },
    })),
    {
      title: '操作', width: 70, align: 'center' as const,
      render: (_: any, __: any, idx: number) => writable && (
        <Popconfirm title="删除该行？" onConfirm={() => delRow(idx)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Row gutter={16}>
      <Col span={7} xl={6}>
        <Card
          title="数据核对组"
          extra={writable && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openMeta('create')}>新建</Button>}
          styles={{ body: { padding: 8 } }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {groups.length === 0 && <Empty description="暂无核对组" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {groups.map((g) => (
              <Card
                key={g.id}
                size="small"
                hoverable
                onClick={() => { setGroupId(g.id); loadGroup(g.id) }}
                style={{
                  borderColor: g.id === groupId ? '#1677ff' : undefined,
                  background: g.id === groupId ? '#e6f4ff' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <Space size={4} style={{ fontSize: 12, color: '#999' }}>
                      <Tag style={{ marginInlineEnd: 0 }}>{g.row_count} 行</Tag>
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>{g.batch_count} 批次</Tag>
                    </Space>
                  </div>
                  {writable && (
                    <Space size={0} onClick={(e) => e.stopPropagation()}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openMeta('edit', g)} />
                      <Popconfirm title="删除该核对组？" onConfirm={() => doDelete(g)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )}
                </div>
              </Card>
            ))}
          </Space>
        </Card>
      </Col>
      <Col span={17} xl={18}>
        <Card
          title={current ? `比对关系配置 - ${current.name}` : '比对关系配置'}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => groupId && loadGroup(groupId)}>重置</Button>
              {writable && (
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={doSave} disabled={!groupId}>
                  保存核对组
                </Button>
              )}
            </Space>
          }
        >
          {!groupId ? (
            <Empty description="请选择或新建一个数据核对组" />
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="以「行」为单位配置跨物料比对关系"
                description="每行选择需要互相比对的字段：AI 核验时同一行中各物料的字段值必须一致（数值/日期/包含按字段匹配方式归一化）；留空的物料列不参与该行比对。例：第1行 封口贴·系列名称 = 铝箔·Name = 任务单·图案名称 = 厂商代码·系列/图案名称。带「多值列」的字段（任务单生产批号列、厂商代码GTIN列）按成员包含判定：其他物料的值存在于该列即可。同一物料列中的字段只能出现在一行中，已被其他行选用的字段会自动从下拉选项里过滤掉。"
              />
              <Table
                rowKey={(_, idx) => String(idx)}
                size="small"
                loading={loading}
                columns={columns as any}
                dataSource={rows}
                pagination={false}
                scroll={{ x: 900 }}
                bordered
                footer={() => writable && (
                  <Button block type="dashed" icon={<PlusOutlined />} onClick={addRow}>添加一行</Button>
                )}
              />
            </>
          )}
        </Card>
      </Col>

      <Modal
        title={metaModal?.mode === 'create' ? '新建数据核对组' : '编辑核对组'}
        open={!!metaModal}
        onOk={submitMeta}
        onCancel={() => setMetaModal(null)}
        destroyOnClose
      >
        <Form form={metaForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="核对组名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：隐形眼镜外包装核对组" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="适用产品/系列说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  )
}
