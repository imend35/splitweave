import type { SplitWeaveApi } from './client'
import { httpApi } from './httpApi'
import { mockApi } from './mockApi'

// The real FastAPI client is the default. Set VITE_USE_MOCK_API=true only when
// demonstrating the standalone Question 3 prototype without a running backend.
export const api: SplitWeaveApi = import.meta.env.VITE_USE_MOCK_API === 'true' ? mockApi : httpApi

export { ApiError } from './client'
