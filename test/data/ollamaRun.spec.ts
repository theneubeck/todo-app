import { describe, it } from 'mocha'
import { expect } from 'chai'
import {
  resolveOllamaApiUrl,
  resolveOllamaModel,
  buildOllamaRequest,
  parseOllamaResponse,
} from '../../src/main/ollamaRun'

describe('resolveOllamaApiUrl', () => {
  it('returns the env var value when OLLAMA_API_URL is set', () => {
    expect(
      resolveOllamaApiUrl({
        OLLAMA_API_URL: 'http://example.test/v1/chat/completions',
      })
    ).to.equal('http://example.test/v1/chat/completions')
  })

  it('returns the default localhost URL when OLLAMA_API_URL is unset', () => {
    expect(resolveOllamaApiUrl({})).to.equal(
      'http://localhost:11434/v1/chat/completions'
    )
  })

  it('returns the default when OLLAMA_API_URL is an empty string', () => {
    expect(resolveOllamaApiUrl({ OLLAMA_API_URL: '' })).to.equal(
      'http://localhost:11434/v1/chat/completions'
    )
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

describe('buildOllamaRequest', () => {
  function parseBody(init: RequestInit): {
    model: string
    messages: { role: string; content: string }[]
    stream: boolean
  } {
    return JSON.parse(init.body as string) as {
      model: string
      messages: { role: string; content: string }[]
      stream: boolean
    }
  }

  it('uses the configured api URL', () => {
    const { url } = buildOllamaRequest({
      apiUrl: 'http://example.test/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: 'sys',
      userPrompt: 'hello',
    })
    expect(url).to.equal('http://example.test/v1/chat/completions')
  })

  it('sets POST as the method', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: '',
      userPrompt: 'hello',
    })
    expect(init.method).to.equal('POST')
  })

  it('sets Content-Type application/json on the headers', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: '',
      userPrompt: 'hello',
    })
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).to.equal('application/json')
  })

  it('sets the resolved model name in the body', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'mymodel:1b',
      systemPrompt: '',
      userPrompt: 'hello',
    })
    const body = parseBody(init)
    expect(body.model).to.equal('mymodel:1b')
  })

  it('places the system prompt first with role system', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: 'you are a helpful assistant',
      userPrompt: 'hello',
    })
    const body = parseBody(init)
    expect(body.messages[0]).to.deep.equal({
      role: 'system',
      content: 'you are a helpful assistant',
    })
  })

  it('places the user prompt next with role user', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: 'sys',
      userPrompt: 'hello',
    })
    const body = parseBody(init)
    expect(body.messages[1]).to.deep.equal({
      role: 'user',
      content: 'hello',
    })
  })

  it('omits the system message when systemPrompt is empty', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: '   \n   ',
      userPrompt: 'hello',
    })
    const body = parseBody(init)
    expect(body.messages).to.have.lengthOf(1)
    expect(body.messages[0]).to.deep.equal({ role: 'user', content: 'hello' })
  })

  it('sets stream to false', () => {
    const { init } = buildOllamaRequest({
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'gemma4:e2b',
      systemPrompt: '',
      userPrompt: 'hello',
    })
    const body = parseBody(init)
    expect(body.stream).to.equal(false)
  })
})

describe('parseOllamaResponse', () => {
  it('returns ok true with trimmed content on 200', () => {
    const body = JSON.stringify({
      choices: [{ message: { content: '  hello world  \n' } }],
    })
    const result = parseOllamaResponse({ status: 200, body })
    expect(result).to.deep.equal({ ok: true, reply: 'hello world' })
  })

  it('returns ok false with the statusCode on non-200', () => {
    const body = JSON.stringify({ error: 'model not found' })
    const result = parseOllamaResponse({ status: 500, body })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.statusCode).to.equal(500)
    expect(result.error).to.contain('model not found')
  })

  it('returns ok false when choices array is missing', () => {
    const body = JSON.stringify({ foo: 'bar' })
    const result = parseOllamaResponse({ status: 200, body })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.statusCode).to.equal(200)
    expect(result.error).to.equal('empty or malformed response')
  })

  it('returns ok false when choices[0].message.content is missing', () => {
    const body = JSON.stringify({ choices: [{ message: {} }] })
    const result = parseOllamaResponse({ status: 200, body })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.statusCode).to.equal(200)
    expect(result.error).to.equal('empty or malformed response')
  })

  it('returns ok false when the JSON body fails to parse', () => {
    const result = parseOllamaResponse({ status: 200, body: 'not json {' })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.statusCode).to.equal(200)
    expect(result.error).to.equal('invalid JSON body from API')
  })
})
