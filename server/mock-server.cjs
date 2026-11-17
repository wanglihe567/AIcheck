// server/mock-server.cjs
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const multer = require('multer')

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
})

// 内存态：文件表 + 两步检测进度
const files = new Map()
const detectState = { step1: null, step2: null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 演示用的三档结果（第一步：电子生产任务单；第二步：包装实物）
const SAMPLES = {
  1: {
    pass: {
      outcome: 'pass',
      message: '电子生产任务单信息完整，校验通过',
      anomalies: []
    },
    warning: {
      outcome: 'warning',
      message: '检测到 1 项信息不一致',
      anomalies: [
        {
          carrier: '任务单第 2 页',
          field: '生产数量',
          expected: '1000',
          actual: '800'
        }
      ]
    },
    failed: {
      outcome: 'failed',
      message: '文件内容无法识别',
      anomalies: [{ carrier: '任务单第 1 页', field: '任务单编号', desc: '未识别到该字段' }]
    }
  },
  2: {
    pass: {
      outcome: 'pass',
      message: '包装实物与生产任务单信息一致',
      anomalies: []
    },
    warning: {
      outcome: 'warning',
      message: '检测到 2 项信息不一致，请人工复核',
      anomalies: [
        {
          carrier: '封口贴',
          field: '生产批次号',
          expected: '20241113-A02',
          actual: '20241113-A01'
        },
        {
          carrier: '内盒',
          field: '有效期',
          expected: '2026-11-12',
          actual: '2025-11-12'
        }
      ]
    },
    failed: {
      outcome: 'failed',
      message: '图片模糊，部分关键信息无法识别',
      anomalies: [
        { carrier: '铝箔', field: '生产日期', desc: '未识别到该字段，请重新拍摄' },
        { carrier: '封口贴', field: '产品规格', desc: '文字模糊，识别置信度过低' }
      ]
    }
  }
}

// Mock：用企微 code 换用户信息 + 业务 token
app.post('/api/auth/wx-code', (req, res) => {
  const { code } = req.body
  console.log('[Mock] 收到 code:', code)

  res.json({
    token: 'mock-token-' + Date.now(),
    userId: 'zhangsan',
    userName: '张三',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan'
  })
})

// Mock：JS-SDK 签名
app.get('/api/wework/jssdk-sign', (req, res) => {
  const { url } = req.query
  const nonceStr = Math.random().toString(36).slice(2)
  const timestamp = Math.floor(Date.now() / 1000)
  const ticket = 'mock-jsapi-ticket'
  const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`
  const signature = crypto.createHash('sha1').update(str).digest('hex')

  res.json({
    corpId: 'wx1234567890',
    agentId: 1000002,
    timestamp,
    nonceStr,
    signature
  })
})

// 第一步：只上传文件
app.post('/api/detect/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: '未收到文件' })
  }
  await sleep(600)

  const fileId = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  const fileName = req.file.originalname || 'upload'
  files.set(fileId, { name: fileName, size: req.file.size, type: req.file.mimetype })

  console.log(`[Mock] 上传文件 ${fileName} (${req.file.size} bytes) → ${fileId}`)
  res.json({ code: 0, data: { fileId, fileName } })
})

// 第二步：点击「检测」后调用
app.post('/api/detect/check', async (req, res) => {
  const { step, fileId, mock } = req.body
  const s = Number(step)

  if (s !== 1 && s !== 2) {
    return res.status(400).json({ code: 400, message: 'step 参数不合法' })
  }
  if (!fileId || !files.has(fileId)) {
    return res.status(400).json({ code: 400, message: '文件不存在，请重新上传' })
  }
  if (s === 2 && detectState.step1?.result?.outcome !== 'pass') {
    return res.status(403).json({ code: 403, message: '请先完成第一步检测' })
  }

  await sleep(1500)

  // 默认通过；联调时传 mock=warning / mock=failed 可查看其他两档
  const outcome = ['pass', 'warning', 'failed'].includes(mock) ? mock : 'pass'
  const result = SAMPLES[s][outcome]

  detectState[`step${s}`] = {
    fileId,
    fileName: files.get(fileId).name,
    result
  }
  console.log(`[Mock] step${s} 检测结果：${outcome}`)
  res.json({ code: 0, data: result })
})

// 查询进度（刷新恢复）
app.get('/api/detect/status', (req, res) => {
  res.json({ code: 0, data: detectState })
})

// 数据核对组列表（与 PC 端 GET /api/groups 返回结构一致）
const groupList = [
  {
    id: 1,
    name: '隐形眼镜外包装核对组',
    remark: '日抛 / 双周抛系列通用',
    row_count: 4,
    batch_count: 3,
    updated_at: '2026-11-15 10:24:00'
  },
  {
    id: 2,
    name: '护理液外包装核对组',
    remark: '500ml / 360ml 规格通用',
    row_count: 3,
    batch_count: 1,
    updated_at: '2026-11-14 16:08:00'
  },
  {
    id: 3,
    name: '润眼液外包装核对组',
    remark: '单支装',
    row_count: 2,
    batch_count: 0,
    updated_at: '2026-11-12 09:41:00'
  }
]

app.get('/api/groups', (req, res) => {
  res.json({ total: groupList.length, items: groupList })
})

// 核验指针可选项（与 PC 端 GET /api/groups/{id}/target-options 返回结构一致）
const targetOptions = {
  1: {
    lots: ['20241113-A01', '20241113-A02', '20241120-B01'],
    gtins: ['6971234567890', '6971234567891']
  },
  2: {
    lots: ['20241008-C01', '20241008-C02'],
    gtins: ['6971234567801']
  },
  3: {
    lots: ['20240921-D01'],
    gtins: []
  }
}

app.get('/api/groups/:id/target-options', (req, res) => {
  res.json(targetOptions[req.params.id] || { lots: [], gtins: [] })
})

// ---------- 基线初始化（与 PC 端 /api/groups/{id}/baseline/{carrier} 一致） ----------
const baselineState = new Map()

app.post('/api/groups/:id/baseline/:carrier', upload.single('file'), async (req, res) => {
  const carrier = req.params.carrier
  if (!['task_order', 'vendor_code'].includes(carrier)) {
    return res.status(400).json({ detail: 'carrier 参数不合法' })
  }
  if (!req.file) return res.status(400).json({ detail: '未收到文件' })

  await sleep(1200)
  const gid = Number(req.params.id)
  const state = baselineState.get(gid) || { task_order: null, vendor_code: null, check: null }
  const data = {
    carrier,
    provider: 'mock-qwen',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    fields: { 生产批号: '20241113-A01', 有效期: '2026-11-12' }
  }
  state[carrier] = data
  state.check =
    state.task_order && state.vendor_code
      ? {
          ok: true,
          results: [
            { row_no: 1, labels: '生产批号 × 批号', result: 'pass', remark: '任务单与厂商代码一致' },
            { row_no: 2, labels: '有效期 × 失效日期', result: 'pass', remark: '任务单与厂商代码一致' }
          ]
        }
      : null
  baselineState.set(gid, state)
  console.log(`[Mock] 核对组 ${gid} 基线 ${carrier} 识别完成`)
  res.json(data)
})

app.get('/api/groups/:id', (req, res) => {
  const gid = Number(req.params.id)
  const g = groupList.find((x) => x.id === gid)
  if (!g) return res.status(404).json({ detail: '核对组不存在' })
  res.json({
    ...g,
    baseline: baselineState.get(gid) || { task_order: null, vendor_code: null, check: null }
  })
})

// ---------- 数据核对批次 / AI 核验会话（与 PC 端接口、字段一致） ----------
const batches = new Map()
let batchSeq = 1
let msgSeq = 1

const now = () => new Date().toISOString()
const serializeBatch = (b) => ({
  id: b.id,
  code: b.code,
  status: b.status,
  conclusion: b.conclusion,
  last_round: b.last_round,
  fail_reason: b.fail_reason,
  group_id: b.group_id,
  group_name: b.group_name,
  target_lot: b.target_lot,
  target_gtin: b.target_gtin,
  messages: b.messages,
  created_at: b.created_at
})

const pushMsg = (b, role, kind, content, extra = {}) => {
  const message = { id: msgSeq++, role, kind, content, created_at: now(), ...extra }
  b.messages.push(message)
  return message
}

const buildRows = (b, passed) => {
  const lot = b.target_lot
  const gtin = b.target_gtin || '6971234567890'
  return [
    {
      row_no: 1,
      result: 'pass',
      remark: '',
      values: [
        { carrier: 'task_order', carrier_name: '生产任务单', label: '生产批号', value: lot, side: 'baseline', is_list: true },
        { carrier: 'seal_sticker', carrier_name: '封口贴', label: '生产批号', value: lot, side: 'material' },
        { carrier: 'aluminum_foil', carrier_name: '铝箔', label: '生产批号', value: lot, side: 'material' }
      ]
    },
    {
      row_no: 2,
      result: passed ? 'pass' : 'fail',
      remark: passed ? '' : '包装盒有效期与生产任务单不一致',
      values: [
        { carrier: 'task_order', carrier_name: '生产任务单', label: '有效期', value: '2026-11-12', side: 'baseline' },
        { carrier: 'box', carrier_name: '包装盒', label: '有效期', value: passed ? '2026-11-12' : '2025-11-12', side: 'material' }
      ]
    },
    {
      row_no: 3,
      result: 'pass',
      remark: '',
      values: [
        { carrier: 'vendor_code', carrier_name: '厂商代码', label: 'GTIN', value: gtin, side: 'baseline', is_list: true },
        { carrier: 'box', carrier_name: '包装盒', label: 'GTIN', value: gtin, side: 'material' }
      ]
    },
    {
      row_no: 4,
      result: 'pass',
      remark: '',
      values: [
        { carrier: 'task_order', carrier_name: '生产任务单', label: '生产日期', value: '2024-11-13', side: 'baseline' },
        { carrier: 'seal_sticker', carrier_name: '封口贴', label: '生产日期', value: '2024-11-13', side: 'material' }
      ]
    }
  ]
}

app.post('/api/batches', (req, res) => {
  const { group_id, target_lot, target_gtin } = req.body || {}
  const group = groupList.find((g) => g.id === Number(group_id))
  if (!group) return res.status(404).json({ detail: '核对组不存在' })
  if (!target_lot) return res.status(400).json({ detail: '生产批号不能为空' })

  const id = batchSeq++
  const batch = {
    id,
    code: 'B' + String(id).padStart(4, '0'),
    status: 'ready',
    conclusion: null,
    last_round: 0,
    fail_reason: '',
    group_id: group.id,
    group_name: group.name,
    target_lot,
    target_gtin: target_gtin || '',
    messages: [],
    created_at: now()
  }
  pushMsg(
    batch,
    'system',
    'text',
    `创建数据核对批次 ${batch.code}，核验指针：生产批号 ${target_lot}${target_gtin ? ` / GTIN ${target_gtin}` : ''}`
  )
  pushMsg(
    batch,
    'assistant',
    'text',
    `批次已创建。请上传【封口贴 + 铝箔 + 包装盒】同框照片，我将按「${group.name}」逐行核验。`
  )
  batches.set(id, batch)
  console.log(`[Mock] 创建批次 ${batch.code}（核对组 ${group_id}，批号 ${target_lot}）`)
  res.json(serializeBatch(batch))
})

app.get('/api/batches/:id', (req, res) => {
  const b = batches.get(Number(req.params.id))
  if (!b) return res.status(404).json({ detail: '批次不存在' })
  res.json(serializeBatch(b))
})

// 上传三合一照片，生成一轮逐行 AI 核验结果
app.post('/api/batches/:id/chat-upload', upload.array('files', 9), async (req, res) => {
  const b = batches.get(Number(req.params.id))
  if (!b) return res.status(404).json({ detail: '批次不存在' })
  if (b.status === 'closed') return res.status(400).json({ detail: '批次已关闭归档' })
  if (b.status === 'locked') return res.status(400).json({ detail: '批次已异常锁定，请先录入整改' })
  if (!req.files || req.files.length === 0) return res.status(400).json({ detail: '请先上传包装照片' })

  await sleep(1500)
  for (const file of req.files) {
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
    pushMsg(b, 'user', 'image', file.originalname || '上传照片', { image_url: imageUrl })
  }

  b.last_round += 1
  // 演示完整业务闭环：首轮不一致并锁定，整改后的复检全部一致
  const passed = b.last_round > 1
  const conclusion = passed ? 'pass' : 'inconsistent'
  const rows = buildRows(b, passed)
  const failReason = '第 2 行：包装盒有效期为 2025-11-12，生产任务单为 2026-11-12'
  b.status = passed ? 'passed' : 'locked'
  b.conclusion = conclusion
  b.fail_reason = passed ? '' : failReason

  pushMsg(
    b,
    'assistant',
    'result',
    passed ? `第 ${b.last_round} 轮核验完成，4 行全部一致，批次已解锁。` : `第 ${b.last_round} 轮核验发现 1 行不一致，批次已异常锁定。`,
    {
      payload: {
        round: b.last_round,
        conclusion,
        recognized: ['seal_sticker', 'aluminum_foil', 'box'],
        qr_count: 2,
        fail_msgs: passed ? [] : [failReason],
        rows
      }
    }
  )
  console.log(`[Mock] 批次 ${b.code} 第 ${b.last_round} 轮 AI 核验：${conclusion}`)
  res.json(serializeBatch(b))
})

app.post('/api/batches/:id/chat-text', (req, res) => {
  const b = batches.get(Number(req.params.id))
  if (!b) return res.status(404).json({ detail: '批次不存在' })
  if (b.status === 'closed') return res.status(400).json({ detail: '批次已关闭归档' })
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ detail: '消息内容不能为空' })

  pushMsg(b, 'user', 'text', content)
  pushMsg(
    b,
    'assistant',
    'text',
    b.status === 'locked'
      ? '当前批次已异常锁定。请先点击「录入整改」填写异常原因与整改措施，再上传三合一照片复检。'
      : '已收到。请上传【封口贴 + 铝箔 + 包装盒】同框照片，我会自动识别并按核对组逐行比对。'
  )
  res.json(serializeBatch(b))
})

app.post('/api/batches/:id/rework', (req, res) => {
  const b = batches.get(Number(req.params.id))
  if (!b) return res.status(404).json({ detail: '批次不存在' })
  if (b.status !== 'locked') return res.status(400).json({ detail: '仅异常锁定批次可录入整改' })
  const reason = String(req.body?.reason || '').trim()
  const action = String(req.body?.action || '').trim()
  if (!reason || !action) return res.status(400).json({ detail: '请填写异常原因与整改措施' })

  b.status = 'rechecking'
  pushMsg(
    b,
    'system',
    'text',
    `已录入异常整改\n异常原因：${reason}\n整改措施：${action}\n批次进入整改复检，请重新上传三合一照片。`
  )
  res.json(serializeBatch(b))
})

app.post('/api/batches/:id/close', (req, res) => {
  const b = batches.get(Number(req.params.id))
  if (!b) return res.status(404).json({ detail: '批次不存在' })
  if (b.status !== 'passed') return res.status(400).json({ detail: '仅核验通过的批次可关闭归档' })
  b.status = 'closed'
  pushMsg(b, 'system', 'text', '批次已关闭归档，会话转为只读。')
  res.json(serializeBatch(b))
})

// 调试：重置
app.post('/api/detect/reset', (req, res) => {
  detectState.step1 = null
  detectState.step2 = null
  res.json({ code: 0, data: detectState })
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`✅ Mock server running at http://localhost:${PORT}`)
  console.log('   前端访问 http://localhost:5173 即可（已配置 proxy）')
})
