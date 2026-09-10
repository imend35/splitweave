import type { SplitWeaveApi } from './client'
import { mockApi } from './mockApi'

// Question 3 uses the mock implementation. Question 5 will switch this single
// export to an HTTP client without changing presentation components.
export const api: SplitWeaveApi = mockApi

export { ApiError } from './client'
