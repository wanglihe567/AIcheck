import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ActionSheet, Button, Dialog, ErrorBlock, Input, Modal, NavBar,
  SafeArea, SpinLoading, Tag, TextArea, Toast
} from 'antd-mobile'
import type { Action } from 'antd-mobile/es/components/action-sheet'
import { chatText, chatUpload, closeBatch, getBatch, rework } from '@/api/batches'
import type { Batch, ChatMessage } from '@/api/batches'
import { compressImage, validateFile } from '@/utils/image'
import { isCanceled, pickFile, warmupWeworkSDK } from '@/utils/wework'
import type { PickSource } from '@/utils/wework'
import { statusMeta } from '@/utils/batchStatus'
import './verify.css'

const CONCLUSION_META: Record<string, { color: 'success' | 'warning' | 'danger'; text: string }> = {
  pass: { color: 'success', text: '一致通过' },
  inconsistent: { color: 'danger', text: '信息不一致' },
  recognition_failed: { color: 'warning', text: '识别失败' }
}

const ACTIONS: Action[] = [
  { text: '拍照', key: 'camera' },
  { text: '从相册选择', key: 'album' }
]

const fmtTime = (v?: string) => v?.replace('T', ' ').slice(11, 19) || ''

export default function Verify() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [text, setText] = useState('')
  const [sheetVisible, setSheetVisible] = useState(false)
  const [reworkOpen, setReworkOpen] = useState(false)
  const [lockExpanded, setLockExpanded] = useState(false)
  const [reason, setReason] = useState('')
  const [action, setAction] = useState('')
  const [reworkSaving, setReworkSaving] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const load = async (silent = false) => {
    try {
      setBatch(await getBatch(id))
      setNotFound(false)
    } catch (e: any) {
      if (!silent) {
        setNotFound(true)
        Toast.show({ icon: 'fail', content: e?.response?.data?.detail || '批次加载失败' })
      }
    }
  }

  useEffect(() => {
    warmupWeworkSDK()
    load()
  }, [id])

  // 新消息自动滚动到底部
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [batch?.messages?.length, processing])

  /** 上传照片进行一轮 AI 核验 */
  const handleUpload = async (source: PickSource) => {
    if (!batch) return
    try {
      const file = await pickFile(source, 'image/*')
      validateFile(file, false)
      const compressed = await compressImage(file)
      setProcessing(true)
      const d = await chatUpload(batch.id, [compressed])
      setBatch(d)
      if (d.conclusion === 'pass') Toast.show({ icon: 'success', content: '本轮核验全部一致，批次已解锁' })
      else if (d.conclusion === 'inconsistent') Toast.show({ icon: 'fail', content: '发现不一致项，批次已锁定，请录入整改' })
      else Toast.show({ icon: 'fail', content: '未能识别物料信息，请重新拍照上传' })
    } catch (e: any) {
      if (!isCanceled(e)) {
        Toast.show({ icon: 'fail', content: e?.response?.data?.detail || e?.message || '上传失败' })
      }
    } finally {
      setProcessing(false)
    }
  }

  const sendText = async () => {
    const content = text.trim()
    if (!content || !batch) return
    setText('')
    setProcessing(true)
    try {
      await chatText(batch.id, content)
      await load(true)
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e?.response?.data?.detail || '发送失败' })
    } finally {
      setProcessing(false)
    }
  }

  const submitRework = async () => {
    if (!batch) return
    if (!reason.trim() || !action.trim()) {
      Toast.show({ icon: 'fail', content: '请填写异常原因与整改措施' })
      return
    }
    setReworkSaving(true)
    try {
      setBatch(await rework(batch.id, reason.trim(), action.trim()))
      setReworkOpen(false)
      setReason('')
      setAction('')
      Toast.show({ icon: 'success', content: '整改措施已记录，请上传照片复检' })
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e?.response?.data?.detail || '提交失败' })
    } finally {
      setReworkSaving(false)
    }
  }

  const doClose = async () => {
    if (!batch) return
    const ok = await Dialog.confirm({ content: '确认本批次核验通过并关闭归档？' })
    if (!ok) return
    try {
      setBatch(await closeBatch(batch.id))
      Toast.show({ icon: 'success', content: '批次已关闭归档' })
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e?.response?.data?.detail || '操作失败' })
    }
  }

  const status = batch?.status || 'ready'
  const batchStatus = statusMeta(status)
  const conclusionMeta = batch?.conclusion ? CONCLUSION_META[batch.conclusion] : null
  const uploadDisabled = processing || status === 'locked' || status === 'closed'

  return (
    <div className="chat-page">
      <NavBar onBack={() => navigate('/')}>AI 核验</NavBar>

      {notFound ? (
        <div className="chat-page__loading">
          <ErrorBlock status="empty" title="批次不存在或无权访问" />
          <Button color="primary" onClick={() => navigate('/detect')}>返回检测页</Button>
        </div>
      ) : !batch ? (
        <div className="chat-page__loading">
          <SpinLoading color="primary" />
        </div>
      ) : (
        <>
          {/* 头部：批次指针（移动端无核验记录入口） */}
          <div className="chat-head">
            <div className="chat-head__tags">
              <span className="chat-head__code">{batch.code}</span>
              {batch.group_name && <Tag color="primary">{batch.group_name}</Tag>}
              <Tag color={batchStatus.color}>{batchStatus.text}</Tag>
              {conclusionMeta && <Tag color={conclusionMeta.color}>{conclusionMeta.text}</Tag>}
            </div>
            <div className="chat-head__pointer">
              当前指针：批号 <b>{batch.target_lot}</b>
              {batch.target_gtin && <> / GTIN <b>{batch.target_gtin}</b></>}
              　· 已核验 {batch.last_round} 轮
            </div>
            {(status === 'locked' || status === 'passed') && (
              <div className="chat-head__actions">
                {status === 'locked' && (
                  <Button color="danger" size="small" onClick={() => setReworkOpen(true)}>录入整改</Button>
                )}
                {status === 'passed' && (
                  <Button color="primary" size="small" onClick={doClose}>关闭归档</Button>
                )}
              </div>
            )}
          </div>

          {/* 锁定提示条：默认收起，避免大段失败原因挤占会话区域 */}
          {status === 'locked' && (
            <div className="chat-lock">
              <button
                type="button"
                className="chat-lock__header"
                aria-expanded={lockExpanded}
                onClick={() => setLockExpanded((prev) => !prev)}
              >
                <span className="chat-lock__title">批次已异常锁定</span>
                <span className="chat-lock__toggle">{lockExpanded ? '收起详情' : '展开详情'}</span>
              </button>
              {lockExpanded && (
                <>
                  <div className="chat-lock__reason">{batch.fail_reason}</div>
                  <div className="chat-lock__tip">请核对现场物料后点击「录入整改」填写原因与整改措施，再上传照片复检。</div>
                </>
              )}
            </div>
          )}

          {/* 消息流 */}
          <div className="chat-body" ref={bodyRef}>
            {(batch.messages || []).map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {processing && (
              <div className="bubble bubble--assistant">
                <span className="bubble__avatar bubble__avatar--ai">AI</span>
                <div className="bubble__text bubble__text--processing">
                  <SpinLoading color="primary" />
                  <span>正在识别照片并按核对组逐行比对，请稍候…</span>
                </div>
              </div>
            )}
          </div>

          {/* 输入栏 */}
          <div className="chat-input">
            {status === 'closed' ? (
              <div className="chat-input__closed">本批次已关闭归档，仅可查看历史会话</div>
            ) : (
              <>
                <div className="chat-input__row">
                  <Button
                    color="primary"
                    fill={uploadDisabled ? 'none' : 'outline'}
                    disabled={uploadDisabled}
                    onClick={() => setSheetVisible(true)}
                  >
                    上传三合一照片
                  </Button>
                  <Input
                    placeholder={status === 'locked' ? '批次已锁定，请先录入整改措施…' : '也可以输入文字询问核验助手…'}
                    value={text}
                    onChange={setText}
                    onEnterPress={sendText}
                    disabled={processing}
                  />
                  <Button color="primary" disabled={processing || !text.trim()} onClick={sendText}>
                    发送
                  </Button>
                </div>
                <div className="chat-input__tip">
                  请拍摄【封口贴 + 铝箔 + 包装盒】同框照片上传；AI 将自动识别二维码/条码并按核对组逐行比对，
                  封口贴/铝箔批号须与任务单批号列一致，铝箔 GIN 码须在厂商代码 GTIN 列中。
                </div>
              </>
            )}
            <SafeArea position="bottom" />
          </div>
        </>
      )}

      <ActionSheet
        visible={sheetVisible}
        actions={ACTIONS}
        onClose={() => setSheetVisible(false)}
        onAction={(a) => {
          setSheetVisible(false)
          handleUpload(a.key as PickSource)
        }}
      />

      {/* 整改录入 */}
      <Modal
        visible={reworkOpen}
        title="录入异常整改措施"
        content={
          <div className="rework-form">
            <div className="rework-form__label">异常原因</div>
            <TextArea
              rows={3}
              value={reason}
              onChange={setReason}
              placeholder="例如：包装盒有效期印刷错误，现场物料为 2025-11-12，任务单为 2026-11-12"
            />
            <div className="rework-form__label">整改措施</div>
            <TextArea
              rows={3}
              value={action}
              onChange={setAction}
              placeholder="例如：已更换正确版本包装盒，重新拍照待复检"
            />
          </div>
        }
        actions={[
          { key: 'cancel', text: '取消', disabled: reworkSaving },
          { key: 'ok', text: reworkSaving ? '提交中…' : '提交并进入复检', primary: true, disabled: reworkSaving }
        ]}
        onAction={(a) => {
          if (a.key === 'ok') submitRework()
          else setReworkOpen(false)
        }}
        onClose={() => setReworkOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------- 消息渲染

function Bubble({ m }: { m: ChatMessage }) {
  const time = fmtTime(m.created_at)

  if (m.role === 'system') {
    return (
      <div className="bubble-system">
        <span className="bubble-system__tag">{m.content}</span>
        <div className="bubble-system__time">{time}</div>
      </div>
    )
  }

  const isUser = m.role === 'user'
  return (
    <div className={`bubble ${isUser ? 'bubble--user' : 'bubble--assistant'}`}>
      <span className={`bubble__avatar ${isUser ? 'bubble__avatar--user' : 'bubble__avatar--ai'}`}>
        {isUser ? '我' : 'AI'}
      </span>
      <div className="bubble__main">
        {m.kind === 'image' ? (
          <img className="bubble__image" src={m.image_url || m.content} alt="上传照片" />
        ) : m.kind === 'result' ? (
          <ResultCard payload={m.payload} content={m.content} />
        ) : (
          <div className={`bubble__text ${isUser ? 'bubble__text--user' : ''}`}>{m.content}</div>
        )}
        <div className={`bubble__meta ${isUser ? 'bubble__meta--user' : ''}`}>
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
      ? { cls: 'result--pass', title: `第 ${payload?.round} 轮核验：全部一致，批次已解锁` }
      : conclusion === 'inconsistent'
        ? { cls: 'result--fail', title: `第 ${payload?.round} 轮核验：发现 ${failCount} 行不一致，批次已锁定` }
        : { cls: 'result--warn', title: `第 ${payload?.round} 轮核验：未能完成识别` }

  return (
    <div className={`result ${head.cls}`}>
      <div className="result__title">{head.title}</div>

      <div className="result__tags">
        <Tag color="success">一致 {passCount} 行</Tag>
        {failCount > 0 && <Tag color="danger">不一致 {failCount} 行</Tag>}
        {naCount > 0 && <Tag>未比对 {naCount} 行</Tag>}
        {payload?.recognized?.length > 0 && (
          <Tag color="primary">
            识别到：{payload.recognized.map((c: string) =>
              ({ seal_sticker: '封口贴', aluminum_foil: '铝箔', box: '包装盒' } as Record<string, string>)[c] || c
            ).join('、')}
          </Tag>
        )}
        {payload?.qr_count > 0 && <Tag color="primary">二维码/条码 {payload.qr_count} 个</Tag>}
      </div>

      {conclusion !== 'pass' && payload?.fail_msgs?.length > 0 && (
        <div className="result__failmsgs">{(payload.fail_msgs || []).join('\n')}</div>
      )}

      {rows.map((r) => (
        <RowResult key={r.row_no} row={r} />
      ))}

      {conclusion === 'pass' && (
        <div className="result__note">所有比对行均已通过，可点击右上角「关闭归档」结束本批次；如需再次确认也可继续上传照片。</div>
      )}
      {conclusion === 'inconsistent' && (
        <div className="result__note">请核对现场物料，点击右上角「录入整改」后重新上传照片复检。</div>
      )}
      {conclusion === 'recognition_failed' && <div className="result__note">{content}</div>}
    </div>
  )
}

function RowResult({ row }: { row: any }) {
  const pass = row.result === 'pass'
  const na = row.result === 'na'
  const values: any[] = row.values || []
  return (
    <div className={`row-result ${pass ? 'row-result--pass' : na ? 'row-result--na' : 'row-result--fail'}`}>
      <div className="row-result__head">
        <span className="row-result__no">第 {row.row_no} 行</span>
        <Tag color={pass ? 'success' : na ? 'default' : 'danger'}>
          {pass ? '一致' : na ? '未比对' : '不一致'}
        </Tag>
        {!pass && !na && row.remark && <span className="row-result__remark">{row.remark}</span>}
      </div>
      <div className="row-result__values">
        {values.map((v, i) => (
          <div className={`chip ${v.side === 'baseline' ? 'chip--baseline' : ''}`} key={i}>
            <span className="chip__carrier">{v.carrier_name}</span>
            <span className="chip__label">{v.label}：</span>
            {!v.value ? (
              <span className="chip__missing">未识别</span>
            ) : (
              <span className={`chip__value ${v.side === 'baseline' ? 'chip__value--baseline' : ''}`}>{v.value}</span>
            )}
            {v.is_list && <span className="chip__list">列</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
