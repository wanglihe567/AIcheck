import { create } from 'zustand'
import type { DetectResult, DetectStatus, DetectStep } from '@/api/detect'

export type UploadStatus = 'idle' | 'uploading' | 'uploaded'

export interface StepState {
  uploadStatus: UploadStatus
  uploadError: string
  /** 后端返回的文件标识，检测时使用 */
  fileId: string
  /** 本地预览地址；仅内存态，刷新后不恢复 */
  preview: string
  fileName: string
  detecting: boolean
  result: DetectResult | null
}

const emptyStep = (): StepState => ({
  uploadStatus: 'idle',
  uploadError: '',
  fileId: '',
  preview: '',
  fileName: '',
  detecting: false,
  result: null
})

interface DetectStore {
  step1: StepState
  step2: StepState
  setStep: (step: DetectStep, patch: Partial<StepState>) => void
  resetStep: (step: DetectStep) => void
  hydrate: (status: DetectStatus) => void
}

export const useDetectStore = create<DetectStore>((set) => ({
  step1: emptyStep(),
  step2: emptyStep(),

  setStep: (step, patch) =>
    set((state) => ({
      [step === 1 ? 'step1' : 'step2']: {
        ...(step === 1 ? state.step1 : state.step2),
        ...patch
      }
    })),

  resetStep: (step) => set({ [step === 1 ? 'step1' : 'step2']: emptyStep() }),

  hydrate: (status) =>
    set({
      step1: status.step1
        ? {
            ...emptyStep(),
            uploadStatus: 'uploaded',
            fileId: status.step1.fileId,
            fileName: status.step1.fileName,
            result: status.step1.result
          }
        : emptyStep(),
      step2: status.step2
        ? {
            ...emptyStep(),
            uploadStatus: 'uploaded',
            fileId: status.step2.fileId,
            fileName: status.step2.fileName,
            result: status.step2.result
          }
        : emptyStep()
    })
}))
