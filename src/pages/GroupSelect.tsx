import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, SafeArea, SpinLoading, Tag, Toast } from 'antd-mobile'
import { fetchGroups, setSelectedGroup } from '@/api/groups'
import { fetchBatches } from '@/api/batches'
import type { BatchBrief } from '@/api/batches'
import type { CoreGroup } from '@/api/groups'
import { statusMeta } from '@/utils/batchStatus'
import './groupSelect.css'

export default function GroupSelect() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<CoreGroup[]>([])
  const [batches, setBatches] = useState<BatchBrief[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    fetchGroups()
      .then((items) => {
        setGroups(items)
        // 默认不选中任何核对组；仅在已选组被删除时清空
        setSelectedId((prev) => (prev && items.some((g) => g.id === prev) ? prev : null))
      })
      .catch(() => setError('数据核对组加载失败，请检查网络后重试'))
      .finally(() => setLoading(false))
    // 进行中的批次：失败时静默降级，不阻塞选组
    fetchBatches({ size: 100 })
      .then((d) => setBatches(d.items))
      .catch(() => setBatches([]))
  }

  useEffect(() => {
    load()
  }, [])

  const handleNext = () => {
    const group = groups.find((g) => g.id === selectedId)
    if (!group) {
      Toast.show({ icon: 'fail', content: '请先选择数据核对组' })
      return
    }
    setSelectedGroup({ id: group.id, name: group.name })
    navigate('/detect')
  }

  /** 当前选中组进行中的批次（已关闭的不展示） */
  const resumeBatches = batches.filter((b) => b.status !== 'closed' && b.group_id === selectedId)

  return (
    <div className="group-page">
      <header className="group-page__header">
        <h1 className="group-page__title">选择数据核对组</h1>
        <p className="group-page__desc">
          数据核对组定义了五种载体（封口贴 / 铝箔 / 包装盒 / 任务单 / 厂商代码）之间的字段比对关系。
          选择一个核对组后，任务单与厂商代码只需识别该组涉及的字段；AI 核验时以「行」为单位逐行比对。
          若还没有核对组，可先到电脑端「数据核对组」菜单创建。
        </p>
      </header>

      <main className="group-page__body">
        {loading ? (
          <div className="group-page__loading">
            <SpinLoading color="primary" />
          </div>
        ) : error ? (
          <div className="group-page__tip">
            <p>{error}</p>
            <Button size="small" onClick={load}>
              重新加载
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="group-page__tip">
            <p>暂无数据核对组</p>
            <p className="group-page__tip-sub">请先到电脑端「数据核对组」菜单创建</p>
          </div>
        ) : (
          groups.map((g) => {
            const active = g.id === selectedId
            return (
              <Fragment key={g.id}>
                <div
                  className={`group-card${active ? ' group-card--active' : ''}`}
                  onClick={() => setSelectedId(g.id)}
                >
                  <div className="group-card__head">
                    <span className="group-card__name">{g.name}</span>
                    <span className={`group-card__radio${active ? ' group-card__radio--on' : ''}`} />
                  </div>
                  {g.remark && <p className="group-card__remark">{g.remark}</p>}
                  <div className="group-card__tags">
                    <span className="group-tag">{g.row_count} 行比对</span>
                    <span className="group-tag group-tag--blue">{g.batch_count} 个批次</span>
                  </div>
                </div>

                {/* 选中组进行中的批次：可直接回到聊天页继续核验 */}
                {active && resumeBatches.length > 0 && (
                  <div className="resume-block">
                    <div className="resume-block__title">进行中的批次（可直接继续核验）</div>
                    {resumeBatches.map((b) => {
                      const meta = statusMeta(b.status)
                      return (
                        <div className="resume-item" key={b.id}>
                          <div className="resume-item__main">
                            <div className="resume-item__head">
                              <span className="resume-item__code">{b.code}</span>
                              <Tag color={meta.color}>{meta.text}</Tag>
                            </div>
                            <div className="resume-item__meta">
                              批号 {b.target_lot || '—'}
                              {b.target_gtin ? ` / GTIN ${b.target_gtin}` : ''} · 第 {b.last_round || 0} 轮
                            </div>
                          </div>
                          <Button
                            size="small"
                            color="primary"
                            fill="outline"
                            onClick={() => navigate(`/verify/${b.id}`)}
                          >
                            继续核验
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Fragment>
            )
          })
        )}
      </main>

      <footer className="group-page__footer">
        <Button block color="primary" size="large" disabled={!selectedId || loading} onClick={handleNext}>
          下一步
        </Button>
        <SafeArea position="bottom" />
      </footer>
    </div>
  )
}
