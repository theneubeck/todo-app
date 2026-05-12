import { describe, it } from 'mocha'
import { expect } from 'chai'
import {
  classifyOllamaResult,
  resolveOllamaModel,
} from '../../src/main/ollamaRun'

describe('classifyOllamaResult', () => {
  it('returns ok true with trimmed stdout when exit code is 0 and stdout is non-empty', () => {
    const result = classifyOllamaResult({
      exitCode: 0,
      stdout: '  Hello, world!  \n',
      stderr: '',
    })
    expect(result).to.deep.equal({ ok: true, reply: 'Hello, world!' })
  })

  it('returns ok false with exitCode when exit code is non-zero', () => {
    const result = classifyOllamaResult({
      exitCode: 1,
      stdout: '',
      stderr: 'Error: model "gemma4:12b" not found, try pulling it first',
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.exitCode).to.equal(1)
    expect(result.error).to.contain('model "gemma4:12b" not found')
  })

  it('returns ok false when exit code is 0 but stdout is empty', () => {
    const result = classifyOllamaResult({
      exitCode: 0,
      stdout: '   \n',
      stderr: '',
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.exitCode).to.equal(0)
    expect(result.error).to.be.a('string').and.not.equal('')
  })

  it('includes the last 200 chars of stderr in the error field when present', () => {
    const long = 'x'.repeat(500) + 'TAIL-MARKER'
    const result = classifyOllamaResult({
      exitCode: 1,
      stdout: '',
      stderr: long,
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).to.contain('TAIL-MARKER')
    // The error field should not contain the full 500-char prefix.
    expect(result.error.length).to.be.lessThan(long.length)
  })
})

describe('resolveOllamaModel', () => {
  it('returns the env var value when OLLAMA_MODEL is set', () => {
    expect(resolveOllamaModel({ OLLAMA_MODEL: 'mymodel:1b' })).to.equal(
      'mymodel:1b'
    )
  })

  it('returns the default gemma4:e2b when OLLAMA_MODEL is unset', () => {
    expect(resolveOllamaModel({})).to.equal('gemma4:e2b')
  })

  it('returns the default when OLLAMA_MODEL is an empty string', () => {
    expect(resolveOllamaModel({ OLLAMA_MODEL: '' })).to.equal('gemma4:e2b')
  })
})
