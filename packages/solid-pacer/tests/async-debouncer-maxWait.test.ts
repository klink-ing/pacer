import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { AsyncDebouncer } from '../src/async-debouncer'

describe('Solid AsyncDebouncer maxWait Option', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should execute via normal trailing debounce when burst ends before maxWait', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('call1')
    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('call2')
    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('call3')
    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('call4')
    vi.advanceTimersByTime(100)
    const promise = debouncer.maybeExecute('call5')

    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(600)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toHaveBeenLastCalledWith('call5')
  })

  it('should not execute before maxWait and should use most recent args when it fires', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('first')
    await vi.advanceTimersByTimeAsync(300)
    debouncer.maybeExecute('second')
    await vi.advanceTimersByTimeAsync(300)
    const promise = debouncer.maybeExecute('third')

    await vi.advanceTimersByTimeAsync(300)
    expect(mockFn).not.toBeCalled()

    await vi.advanceTimersByTimeAsync(100)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('third')
    expect(debouncer.store.state.successCount).toBe(1)
    expect(debouncer.store.state.settleCount).toBe(1)
  })

  it('should execute at wait time when calls stop before maxWait', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    const promise = debouncer.maybeExecute('call')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(500)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('call')

    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should force execution at maxWait intervals with continuous calls', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    let lastPromise
    for (let i = 0; i < 20; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should work with leading edge execution', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
    })

    const promise1 = debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('first')

    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('second')
    vi.advanceTimersByTime(100)
    const promise3 = debouncer.maybeExecute('third')

    expect(mockFn).toBeCalledTimes(1)

    vi.advanceTimersByTime(800)
    await Promise.all([promise1, promise3])
    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('third')
  })

  it('should work with trailing edge disabled', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
      trailing: false,
    })

    const promise1 = debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await Promise.all([promise1, lastPromise])
    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('call9')
  })

  it('should clear maxWait timer on flush', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('test')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(300)
    await debouncer.flush()
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('test')

    vi.advanceTimersByTime(700)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should flush correctly after maxWait has already fired during a burst', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    for (let i = 0; i < 12; i++) {
      debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(mockFn).toBeCalledTimes(1)

    debouncer.maybeExecute('post-maxwait-1')
    await vi.advanceTimersByTimeAsync(100)
    debouncer.maybeExecute('post-maxwait-2')
    expect(debouncer.store.state.isPending).toBe(true)

    await debouncer.flush()
    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('post-maxwait-2')

    await vi.advanceTimersByTimeAsync(1500)
    expect(mockFn).toBeCalledTimes(2)
  })

  it('should clear maxWait timer on cancel', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    const promise = debouncer.maybeExecute('test')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(300)
    debouncer.cancel()

    vi.advanceTimersByTime(700)
    await promise
    expect(mockFn).not.toBeCalled()
  })

  it('should clear maxWait timer when disabled and start fresh on re-enable', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('call1')
    vi.advanceTimersByTime(300)
    debouncer.maybeExecute('call2')

    debouncer.setOptions({ enabled: false })
    expect(mockFn).not.toBeCalled()
    expect(debouncer.store.state.isPending).toBe(false)

    vi.advanceTimersByTime(700)
    expect(mockFn).not.toBeCalled()

    debouncer.setOptions({ enabled: true })
    const promise = debouncer.maybeExecute('fresh')
    await vi.advanceTimersByTimeAsync(500)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('fresh')
  })

  it('should handle dynamic maxWait function', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    let maxWaitValue = 1000
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: () => maxWaitValue,
    })

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(1)

    maxWaitValue = 500

    for (let i = 0; i < 5; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should handle maxWait less than wait', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 1000,
      maxWait: 500,
    })

    let lastPromise
    for (let i = 0; i < 5; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 5; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should force execution on next tick when maxWait is 0', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 1000,
      maxWait: 0,
    })

    const promise = debouncer.maybeExecute('immediate')
    expect(mockFn).not.toBeCalled()

    await vi.advanceTimersByTimeAsync(0)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('immediate')

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should treat negative maxWait like 0 (fires on next tick)', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 1000,
      maxWait: -100,
    })

    const promise = debouncer.maybeExecute('negative')
    expect(mockFn).not.toBeCalled()

    await vi.advanceTimersByTimeAsync(0)
    await promise
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('negative')

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should work without maxWait (backward compatibility)', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
    })

    let lastPromise
    for (let i = 0; i < 20; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(500)
    await lastPromise
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should restart maxWait timer on new burst after completion', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`burst1-${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`burst2-${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should handle maxWait with both leading and trailing', async () => {
    const mockFn = vi.fn().mockResolvedValue('result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
      trailing: true,
    })

    const promise1 = debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await Promise.all([promise1, lastPromise])
    expect(mockFn).toBeCalledTimes(2)

    lastPromise = debouncer.maybeExecute('trailing')
    await vi.advanceTimersByTimeAsync(500)
    await lastPromise
    expect(mockFn).toBeCalledTimes(3)
  })

  it('should handle errors with maxWait', async () => {
    const error = new Error('test error')
    const mockFn = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      onError,
    })

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    await lastPromise

    expect(mockFn).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(error, ['call9'], debouncer)
    expect(debouncer.store.state.errorCount).toBe(1)
  })

  it('should return result from maxWait execution', async () => {
    const mockFn = vi.fn().mockResolvedValue('maxWait result')
    const debouncer = new AsyncDebouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    let lastPromise
    for (let i = 0; i < 10; i++) {
      lastPromise = debouncer.maybeExecute(`call${i}`)
      await vi.advanceTimersByTimeAsync(100)
    }

    const result = await lastPromise
    expect(result).toBe('maxWait result')
    expect(mockFn).toBeCalledTimes(1)
  })
})
