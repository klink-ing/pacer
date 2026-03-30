import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Debouncer } from '../src/debouncer'

describe('Preact Debouncer maxWait Option', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should execute via normal trailing debounce when burst ends before maxWait', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
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
    debouncer.maybeExecute('call5')

    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(600)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toHaveBeenLastCalledWith('call5')
  })

  it('should not execute before maxWait and should use most recent args when it fires', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('first')
    vi.advanceTimersByTime(300)
    debouncer.maybeExecute('second')
    vi.advanceTimersByTime(300)
    debouncer.maybeExecute('third')

    vi.advanceTimersByTime(300)
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(100)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('third')
    expect(debouncer.store.state.executionCount).toBe(1)
  })

  it('should execute at wait time when calls stop before maxWait', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('call')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('call')

    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should force execution at maxWait intervals with continuous calls', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    for (let i = 0; i < 25; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should work with leading edge execution', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
    })

    debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('first')

    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('second')
    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('third')

    expect(mockFn).toBeCalledTimes(1)

    vi.advanceTimersByTime(800)
    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('third')
  })

  it('should work with trailing edge disabled', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
      trailing: false,
    })

    debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 10; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('call9')
  })

  it('should clear maxWait timer on flush', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('test')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(300)
    debouncer.flush()
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('test')

    vi.advanceTimersByTime(700)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should flush correctly after maxWait has already fired during a burst', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    for (let i = 0; i < 12; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }
    expect(mockFn).toBeCalledTimes(1)

    debouncer.maybeExecute('post-maxwait-1')
    vi.advanceTimersByTime(100)
    debouncer.maybeExecute('post-maxwait-2')
    expect(debouncer.store.state.isPending).toBe(true)

    debouncer.flush()
    expect(mockFn).toBeCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('post-maxwait-2')

    vi.advanceTimersByTime(1500)
    expect(mockFn).toBeCalledTimes(2)
  })

  it('should clear maxWait timer on cancel', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    debouncer.maybeExecute('test')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(300)
    debouncer.cancel()

    vi.advanceTimersByTime(700)
    expect(mockFn).not.toBeCalled()
  })

  it('should clear maxWait timer when disabled and start fresh on re-enable', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
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
    debouncer.maybeExecute('fresh')
    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('fresh')
  })

  it('should handle dynamic maxWait function', () => {
    const mockFn = vi.fn()
    let maxWaitValue = 1000
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: () => maxWaitValue,
    })

    for (let i = 0; i < 10; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(1)

    maxWaitValue = 500

    for (let i = 0; i < 5; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should handle maxWait less than wait', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 1000,
      maxWait: 500,
    })

    for (let i = 0; i < 5; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 5; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should force execution on next tick when maxWait is 0', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 1000,
      maxWait: 0,
    })

    debouncer.maybeExecute('immediate')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(0)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('immediate')

    vi.advanceTimersByTime(1000)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should treat negative maxWait like 0 (fires on next tick)', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 1000,
      maxWait: -100,
    })

    debouncer.maybeExecute('negative')
    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(0)
    expect(mockFn).toBeCalledTimes(1)
    expect(mockFn).toBeCalledWith('negative')

    vi.advanceTimersByTime(1000)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should work without maxWait (backward compatibility)', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
    })

    for (let i = 0; i < 20; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).not.toBeCalled()

    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)
  })

  it('should restart maxWait timer on new burst after completion', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
    })

    for (let i = 0; i < 10; i++) {
      debouncer.maybeExecute(`burst1-${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(1)

    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 10; i++) {
      debouncer.maybeExecute(`burst2-${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)
  })

  it('should handle maxWait with both leading and trailing', () => {
    const mockFn = vi.fn()
    const debouncer = new Debouncer(mockFn, {
      wait: 500,
      maxWait: 1000,
      leading: true,
      trailing: true,
    })

    debouncer.maybeExecute('first')
    expect(mockFn).toBeCalledTimes(1)

    for (let i = 0; i < 10; i++) {
      debouncer.maybeExecute(`call${i}`)
      vi.advanceTimersByTime(100)
    }

    expect(mockFn).toBeCalledTimes(2)

    debouncer.maybeExecute('trailing')
    vi.advanceTimersByTime(500)
    expect(mockFn).toBeCalledTimes(3)
  })
})
