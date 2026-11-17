import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionSheet, Button, ImageViewer, Picker, SafeArea, SpinLoading, Tag, Toast } from 'antd-mobile'
import type { Action } from 'antd-mobile/es/components/action-sheet'
import { fetchTargetOptions, getGroupBaseline, getSelectedGroup, uploadBaseline } from '@/api/groups'
import { createBatch } from '@/api/batches'
import { compressImage, validateFile } from '@/utils/image'
import { isCanceled, pickFile, warmupWeworkSDK } from '@/utils/wework'
import type { PickSource } from '@/utils/wework'
import './detect.css'

/** 页面标题，按业务替换 */
const PAGE_TITLE = '初始化基线'

const ACTIONS: Action[] = [
  { text: '拍照', key: 'camera' },
  { text: '从相册选择', key: 'album' }
]

type Carrier = 'task_order' | 'vendor_code'

/** 基线上传状态（识别字段详情不在移动端展示） */
interface BaselineSide {
  preview: string
  uploading: boolean
  recognized: boolean
  error: string
}

const EMPTY_SIDE: BaselineSide = { preview: '', uploading: false, recognized: false, error: '' }

export default function Detect() {
  const navigate = useNavigate()
  const [group] = useState(() => getSelectedGroup())

  // 第 1 步：生产任务单（基线）/ 厂商代码（基线）+ 交叉校验
  const [taskOrder, setTaskOrder] = useState<BaselineSide>(EMPTY_SIDE)
  const [vendorCode, setVendorCode] = useState<BaselineSide>(EMPTY_SIDE)
  const [check, setCheck] = useState<any>(null)
  const [sheetCarrier, setSheetCarrier] = useState<'' | Carrier>('')
  // 大图预览：当前正在查看基线照片的载体
  const [viewerCarrier, setViewerCarrier] = useState<'' | Carrier>('')

  // 第 2 步：数据核对批次（核验指针）——可选项来自本次上传图片的识别结果
  const [lots, setLots] = useState<string[]>([])
  const [gtins, setGtins] = useState<string[]>([])
  const [lot, setLot] = useState('')
  const [gtin, setGtin] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // 预热企微 JS-SDK，保证点击时已是就绪状态（iOS 需要同步可用的通道）
    warmupWeworkSDK()
  }, [])

  const setSide = (carrier: Carrier, patch: Partial<BaselineSide>) => {
    const setter = carrier === 'task_order' ? setTaskOrder : setVendorCode
    setter((prev) => ({ ...prev, ...patch }))
  }

  /** 上传基线照片并 AI 识别（与 PC 基线初始化同一接口） */
  const handleUpload = async (carrier: Carrier, source: PickSource) => {
    if (!group) {
      Toast.show({ icon: 'fail', content: '请先返回上一步选择数据核对组' })
      return
    }
    try {
      const file = await pickFile(source, 'image/*')
      validateFile(file, false)
      const compressed = await compressImage(file)
      setSide(carrier, {
        preview: URL.createObjectURL(compressed),
        uploading: true,
        recognized: false,
        error: ''
      })

      await uploadBaseline(group.id, carrier, compressed)
      // 识别成功后，拉取本次基线识别出的批号 / GTIN 及最新交叉校验结果
      const [g, options] = await Promise.all([
        getGroupBaseline(group.id),
        fetchTargetOptions(group.id)
      ])
      setSide(carrier, { uploading: false, recognized: true })
      setCheck(g.baseline?.check ?? null)
      setLots(options.lots)
      setGtins(options.gtins)
      // 重新识别后，已选值若不在最新识别结果中则清空
      setLot((prev) => (prev && !options.lots.includes(prev) ? '' : prev))
      setGtin((prev) => (prev && !options.gtins.includes(prev) ? '' : prev))
      Toast.show({ icon: 'success', content: '识别成功' })
    } catch (e: any) {
      if (isCanceled(e)) return
      const message = e?.response?.data?.detail || e?.message || '识别失败，请重新上传'
      setSide(carrier, { uploading: false, recognized: false, error: message })
      Toast.show({ icon: 'fail', content: message })
    }
  }

  const bothRecognized = taskOrder.recognized && vendorCode.recognized
  const baselineReady = bothRecognized && !!check?.ok
  const canCreate = !!group && !!lot && baselineReady && !creating

  /** 第 2 步选择完成后：创建批次并进入 AI 核验（与 PC 同一接口、同一页面逻辑） */
  const handleCreateBatch = async () => {
    if (!canCreate) return
    setCreating(true)
    try {
      const batch = await createBatch({
        group_id: group.id,
        target_lot: lot,
        target_gtin: gtin || undefined
      })
      navigate(`/verify/${batch.id}`)
    } catch (e: any) {
      Toast.show({
        icon: 'fail',
        content: e?.response?.data?.detail || e?.response?.data?.message || '创建批次失败'
      })
    } finally {
      setCreating(false)
    }
  }

  const sides: { key: Carrier; label: string; side: BaselineSide }[] = [
    { key: 'task_order', label: '生产任务单（基线）', side: taskOrder },
    { key: 'vendor_code', label: '厂商代码（基线）', side: vendorCode }
  ]

  const viewerUrl =
    viewerCarrier === 'task_order'
      ? taskOrder.preview
      : viewerCarrier === 'vendor_code'
        ? vendorCode.preview
        : ''

  return (
    <div className="detect-page">
      <header className="detect-page__header">
        <h1 className="detect-page__title">{PAGE_TITLE}</h1>
        <p className="detect-page__subtitle">上传基线并选定核验批号后，创建批次进入 AI 核验</p>
      </header>

      <main className="detect-page__body">
        <section className="upload-card">
          <header className="upload-card__header">
            <span className="upload-card__index">1</span>
            <div className="upload-card__titles">
              <h3 className="upload-card__title">初始化任务单 / 厂商代码</h3>
              <p className="upload-card__desc">分别上传生产任务单与厂商代码照片，AI 识别后自动交叉校验</p>
            </div>
          </header>

          <div className="baseline-pair">
            {sides.map(({ key, label, side }) => (
              <div className="baseline-box" key={key}>
                <div className="baseline-box__label">{label}</div>
                <div
                  className="baseline-box__area"
                  onClick={() => {
                    if (side.uploading) return
                    // 有照片时点击放大预览，无照片时选择上传方式
                    if (side.preview) setViewerCarrier(key)
                    else setSheetCarrier(key)
                  }}
                >
                  {side.uploading ? (
                    <>
                      {side.preview && <img src={side.preview} alt={label} />}
                      <div className="baseline-box__mask">
                        <SpinLoading color="white" />
                        <span>AI 识别中…</span>
                      </div>
                    </>
                  ) : side.preview ? (
                    <>
                      <img src={side.preview} alt={label} />
                      {side.recognized && <span className="baseline-box__badge">识别成功</span>}
                      <span
                        className="baseline-box__reupload"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSheetCarrier(key)
                        }}
                      >
                        重新上传
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="baseline-box__plus">+</span>
                      <span>上传照片</span>
                    </>
                  )}
                </div>
                {side.error && <p className="baseline-box__error">{side.error}</p>}
              </div>
            ))}
          </div>

          {bothRecognized && (
            <div className="baseline-check">
              <div className="baseline-check__title">任务单 × 厂商代码 交叉校验</div>
              <div
                className={`baseline-check__banner ${
                  check?.ok ? 'baseline-check__banner--ok' : 'baseline-check__banner--fail'
                }`}
              >
                {check?.ok
                  ? '交叉校验通过：任务单与厂商代码中需互相比对的字段全部一致'
                  : '交叉校验未通过：请核对照片后重新上传'}
              </div>
              {(check?.results || []).map((row: any) => (
                <div className="baseline-check__row" key={row.row_no}>
                  <span className="baseline-check__rowno">第 {row.row_no} 行</span>
                  <div className="baseline-check__labels">
                    {row.labels}
                    {row.remark && <div className="baseline-check__remark">{row.remark}</div>}
                  </div>
                  <Tag color={row.result === 'pass' ? 'success' : row.result === 'fail' ? 'danger' : 'default'}>
                    {row.result === 'pass' ? '一致' : row.result === 'fail' ? '不一致' : '未比对'}
                  </Tag>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="upload-card">
          <header className="upload-card__header">
            <span className="upload-card__index">2</span>
            <div className="upload-card__titles">
              <h3 className="upload-card__title">创建数据核对批次</h3>
              <p className="upload-card__desc">
                批次按「生产批号 / GTIN」区分：同一核对组下，更换批号或 GTIN 即为新批次。
              </p>
            </div>
          </header>

          {!group ? (
            <div className="batch-card__tip">未选择数据核对组，请返回上一步重新选择</div>
          ) : (
            <div className="batch-card__fields">
              <div className="batch-field">
                <div className="batch-field__label">本次核验生产批号（必选，来自任务单批号列）</div>
                {taskOrder.recognized ? (
                  <Picker
                    columns={[lots.map((x) => ({ label: x, value: x }))]}
                    value={lot ? [lot] : []}
                    onConfirm={(v) => setLot(String(v[0] ?? ''))}
                  >
                    {(items, { open }) => (
                      <div className="batch-field__control" onClick={open}>
                        <span className={items[0] ? 'batch-field__value' : 'batch-field__placeholder'}>
                          {items[0]?.label ?? '选择生产批号'}
                        </span>
                        <span className="batch-field__arrow">›</span>
                      </div>
                    )}
                  </Picker>
                ) : (
                  <p className="batch-field__hint">请先上传并识别生产任务单</p>
                )}
                {taskOrder.recognized && lots.length === 0 && (
                  <p className="batch-field__hint">任务单中未识别到批号列</p>
                )}
              </div>

              <div className="batch-field">
                <div className="batch-field__label">本次核验 GTIN / GIN 码（可选，来自厂商代码 GTIN 列）</div>
                {vendorCode.recognized ? (
                  <Picker
                    columns={[
                      [
                        { label: '不选择 GTIN', value: '' },
                        ...gtins.map((x) => ({ label: x, value: x }))
                      ]
                    ]}
                    value={gtin ? [gtin] : []}
                    onConfirm={(v) => setGtin(String(v[0] ?? ''))}
                  >
                    {(items, { open }) => (
                      <div className="batch-field__control" onClick={open}>
                        <span className={items[0] ? 'batch-field__value' : 'batch-field__placeholder'}>
                          {items[0]?.label ?? '选择 GTIN（可不选）'}
                        </span>
                        <span className="batch-field__arrow">›</span>
                      </div>
                    )}
                  </Picker>
                ) : (
                  <p className="batch-field__hint">请先上传并识别厂商代码</p>
                )}
                {vendorCode.recognized && gtins.length === 0 && (
                  <p className="batch-field__hint">厂商代码中未识别到 GTIN 列</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="detect-page__footer">
        <Button block color="primary" size="large" onClick={() => navigate('/')}>
          上一步
        </Button>
        <Button
          block
          color="primary"
          size="large"
          loading={creating}
          disabled={!canCreate}
          onClick={handleCreateBatch}
        >
          创建批次并进入AI核验
        </Button>
        <SafeArea position="bottom" />
      </footer>

      <ActionSheet
        visible={!!sheetCarrier}
        actions={ACTIONS}
        onClose={() => setSheetCarrier('')}
        onAction={(a) => {
          const carrier = sheetCarrier as Carrier
          setSheetCarrier('')
          handleUpload(carrier, a.key as PickSource)
        }}
      />

      {/* 基线照片大图预览 */}
      <ImageViewer image={viewerUrl} visible={!!viewerUrl} onClose={() => setViewerCarrier('')} />
    </div>
  )
}
