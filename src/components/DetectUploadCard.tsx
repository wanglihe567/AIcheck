import { ActionSheet, Button, SpinLoading } from 'antd-mobile'
import type { DetectAnomaly, DetectOutcome } from '@/api/detect'
import type { StepState } from '@/store/useDetectStore'
import type { PickSource } from '@/utils/wework'

interface Props {
  index: number
  title: string
  description?: string
  /** 上传区主文案 */
  uploadText?: string
  /** 是否允许选择 PDF 等文件 */
  allowPdf?: boolean
  state: StepState
  disabled?: boolean
  disabledText?: string
  onPick: (source: PickSource) => void
  onDetect: () => void
}

const OUTCOME_LABEL: Record<DetectOutcome, string> = {
  pass: '一致通过',
  warning: '信息不一致预警',
  failed: '信息缺失 / 识别失败'
}

function CameraIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .83-.45l.9-1.35A1 1 0 0 1 9.26 4.7h5.48a1 1 0 0 1 .83.45l.9 1.35a1 1 0 0 0 .83.45h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" />
      <path d="M13.5 3.5v5h5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 1 1 8 0v2.7" />
    </svg>
  )
}

function StatusTag({ state, disabled }: { state: StepState; disabled: boolean }) {
  if (disabled) return null
  if (state.detecting) return <span className="upload-card__tag upload-card__tag--loading">检测中</span>
  if (state.uploadStatus === 'uploading') {
    return <span className="upload-card__tag upload-card__tag--loading">上传中</span>
  }
  if (state.result) {
    const cls =
      state.result.outcome === 'pass'
        ? 'upload-card__tag--pass'
        : state.result.outcome === 'warning'
          ? 'upload-card__tag--warning'
          : 'upload-card__tag--fail'
    return <span className={`upload-card__tag ${cls}`}>{OUTCOME_LABEL[state.result.outcome]}</span>
  }
  if (state.uploadStatus === 'uploaded') {
    return <span className="upload-card__tag upload-card__tag--ready">待检测</span>
  }
  return null
}

function AnomalyItem({ item }: { item: DetectAnomaly }) {
  return (
    <li className="anomaly">
      <div className="anomaly__head">
        <span className="anomaly__carrier">{item.carrier}</span>
        <span className="anomaly__field">{item.field}</span>
      </div>
      {(item.expected || item.actual) && (
        <div className="anomaly__compare">
          <div className="anomaly__row">
            <span className="anomaly__label">应为</span>
            <span className="anomaly__value anomaly__value--expected">{item.expected || '—'}</span>
          </div>
          <div className="anomaly__row">
            <span className="anomaly__label">实际</span>
            <span className="anomaly__value anomaly__value--actual">{item.actual || '—'}</span>
          </div>
        </div>
      )}
      {item.desc && <p className="anomaly__desc">{item.desc}</p>}
    </li>
  )
}

function ResultPanel({ state }: { state: StepState }) {
  const result = state.result
  if (!result) return null

  return (
    <div className={`detect-result detect-result--${result.outcome}`}>
      <div className="detect-result__head">
        <span className="detect-result__title">检测结果</span>
        <span className="detect-result__badge">{OUTCOME_LABEL[result.outcome]}</span>
      </div>
      {result.message && <p className="detect-result__message">{result.message}</p>}
      {result.anomalies.length > 0 && (
        <>
          <p className="detect-result__subtitle">异常明细（共 {result.anomalies.length} 项）</p>
          <ul className="detect-result__list">
            {result.anomalies.map((item, i) => (
              <AnomalyItem key={`${item.carrier}-${item.field}-${i}`} item={item} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function DetectUploadCard({
  index,
  title,
  description,
  uploadText = '点击上传图片',
  allowPdf = false,
  state,
  disabled = false,
  disabledText = '',
  onPick,
  onDetect
}: Props) {
  const busy = state.uploadStatus === 'uploading' || state.detecting

  const openActionSheet = () => {
    if (disabled || busy) return
    const actions = [
      { key: 'camera', text: '拍照' },
      { key: 'album', text: '从相册选择' }
    ]
    if (allowPdf) {
      actions.push({ key: 'file', text: '选择 PDF / 文件' })
    }
    const handler = ActionSheet.show({
      actions,
      onAction: (action) => {
        handler.close()
        onPick(action.key as PickSource)
      },
      onClose: () => handler.close()
    })
  }

  const renderPlaceholder = () => {
    if (disabled) {
      return (
        <div className="upload-card__placeholder upload-card__placeholder--disabled">
          <LockIcon />
          <span>{disabledText || '请先完成上一步检测'}</span>
        </div>
      )
    }

    if (state.uploadStatus === 'uploading') {
      return (
        <div className="upload-card__placeholder upload-card__placeholder--loading">
          <SpinLoading color="primary" />
          <span>上传中，请稍候…</span>
        </div>
      )
    }

    return (
      <button type="button" className="upload-card__placeholder" onClick={openActionSheet}>
        <CameraIcon />
        <span>{uploadText}</span>
        <span className="upload-card__hint">
          {allowPdf ? '支持拍照、相册或 PDF 文件' : '支持拍照或从相册选择'}
        </span>
      </button>
    )
  }

  const renderUploaded = () => (
    <div className="upload-card__file-row">
      {state.preview ? (
        <img className="upload-card__preview" src={state.preview} alt="已上传文件预览" />
      ) : (
        <div className="upload-card__preview upload-card__file">
          <FileIcon />
          <span className="upload-card__file-name">{state.fileName || '已上传'}</span>
        </div>
      )}
      <div className="upload-card__file-info">
        <p className="upload-card__file-title">
          {state.fileName || '已上传'}
        </p>
        <p className="upload-card__file-tip">文件已上传，点击下方按钮开始检测</p>
        <Button size="mini" fill="none" color="primary" disabled={busy} onClick={openActionSheet}>
          重新上传
        </Button>
      </div>
    </div>
  )

  const canDetect = state.uploadStatus === 'uploaded' && !state.detecting

  return (
    <section className={disabled ? 'upload-card upload-card--disabled' : 'upload-card'}>
      <header className="upload-card__header">
        <span className="upload-card__index">{index}</span>
        <div className="upload-card__titles">
          <h3 className="upload-card__title">{title}</h3>
          {description && <p className="upload-card__desc">{description}</p>}
        </div>
        <StatusTag state={state} disabled={disabled} />
      </header>

      {state.uploadStatus === 'uploaded' ? renderUploaded() : renderPlaceholder()}

      {!disabled && (
        <div className="upload-card__actions">
          <Button
            block
            color="primary"
            disabled={!canDetect}
            loading={state.detecting}
            loadingText="检测中…"
            onClick={onDetect}
          >
            {state.result ? '重新检测' : '检测'}
          </Button>
          {state.uploadStatus === 'idle' && !state.uploadError && (
            <p className="upload-card__action-tip">上传文件后可开始检测</p>
          )}
          {state.uploadError && <p className="upload-card__action-error">{state.uploadError}</p>}
        </div>
      )}

      {!disabled && <ResultPanel state={state} />}
    </section>
  )
}
