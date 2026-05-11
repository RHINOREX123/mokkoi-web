export interface MilestoneEvent {
  id: string
  kind: 'analyzing' | 'identified' | 'generating' | 'complete' | 'error'
  message: string
  status: 'pending' | 'inflight' | 'done' | 'failed'
}
