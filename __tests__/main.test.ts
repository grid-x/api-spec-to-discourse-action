import * as core from '@actions/core'
import Axios from 'axios'
import fs from 'fs'
import { postBody, run } from '../src/main'

jest.mock('@actions/core')
jest.mock('axios')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn()
}))
jest.mock('form-data', () =>
  jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({})
  }))
)

const uploadResult = {
  url: 'https://example.com/uploads/file.yaml',
  short_url: 'upload://abc123.yaml',
  short_path: 'uploads/short/abc123.yaml',
  original_filename: 'petstore.yaml'
}

describe('postBody', () => {
  it('generates a post body with the expected content', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'
    jest
      .spyOn(global, 'Date')
      .mockImplementation(() => ({ toISOString: () => fixedDate }) as any)

    const result = postBody('discourse.example.com', uploadResult, 'abc1234  ')

    expect(result).toContain('petstore.yaml')
    expect(result).toContain(
      'https://discourse.example.com/uploads/short/abc123.yaml'
    )
    expect(result).toContain('upload://abc123.yaml')
    expect(result).toContain('sha abc1234') // commit is trimmed
    expect(result).toContain(fixedDate)

    jest.restoreAllMocks()
  })

  it('matches the exact full content', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'
    jest
      .spyOn(global, 'Date')
      .mockImplementation(() => ({ toISOString: () => fixedDate }) as any)

    const result = postBody('discourse.example.com', uploadResult, 'abc1234  ')

    expect(result).toBe(
      'API Documentation/Specification `petstore.yaml`\n' +
        '\n' +
        '```apidoc\n' +
        'https://discourse.example.com/uploads/short/abc123.yaml\n' +
        '```\n' +
        '\n' +
        '[petstore.yaml|attachment](upload://abc123.yaml)\n' +
        '\n' +
        '*last updated*: 2024-01-01T00:00:00.000Z (sha abc1234)\n'
    )

    jest.restoreAllMocks()
  })

  it('uses a custom body template when provided', () => {
    const customTemplate = 'Custom: {ORIGINAL_FILENAME} at {DISCOURSE_URL}'
    const result = postBody(
      'discourse.example.com',
      uploadResult,
      'abc1234',
      customTemplate
    )
    expect(result).toBe('Custom: petstore.yaml at discourse.example.com')
  })
})

const mockPost = jest.fn()
const mockHttp = {
  post: mockPost,
  interceptors: { request: { use: jest.fn() } }
}

const uploadApiResponse = {
  url: 'https://discourse.example.com/uploads/file.yaml',
  short_url: 'upload://abc123.yaml',
  short_path: 'uploads/short/abc123.yaml',
  original_filename: 'petstore.yaml'
}

const runArgs = [
  'discourse.example.com',
  '42',
  'api-key',
  'api-user',
  'abc1234',
  'petstore.yaml'
] as const

describe('run', () => {
  beforeEach(() => {
    ;(Axios.create as jest.Mock).mockReturnValue(mockHttp)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('spec content'))
  })

  describe('success', () => {
    beforeEach(() => {
      mockPost.mockResolvedValue({ data: uploadApiResponse })
      global.fetch = jest.fn().mockResolvedValue({ statusText: 'OK' })
    })

    it('creates the Axios instance with the correct base URL and auth headers', async () => {
      await run(...runArgs)

      expect(Axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://discourse.example.com',
          headers: expect.objectContaining({
            'Api-Key': 'api-key',
            'Api-Username': 'api-user'
          })
        })
      )
    })

    it('reads the spec file and posts it to /uploads.json', async () => {
      await run(...runArgs)

      expect(fs.readFileSync).toHaveBeenCalledWith('petstore.yaml')
      expect(mockPost).toHaveBeenCalledWith(
        '/uploads.json',
        expect.anything(),
        {
          params: { type: 'composer', synchronous: true }
        }
      )
    })

    it('sends a PUT request to the post URL with auth headers and post body', async () => {
      await run(...runArgs)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discourse.example.com/posts/42.json',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Api-Key': 'api-key',
            'Api-Username': 'api-user'
          })
        })
      )
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.post.edit_reason).toBe('Uploaded spec at abc1234')
      expect(body.post.raw).toContain('petstore.yaml')
    })
  })

  it('calls core.setFailed when the upload request fails', async () => {
    mockPost.mockRejectedValue(new Error('Network error'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    await run(...runArgs)

    expect(core.setFailed).toHaveBeenCalledWith('Network error')
  })

  it('calls core.error and process.exit(1) when updating the post fails', async () => {
    mockPost.mockResolvedValue({ data: uploadApiResponse })
    global.fetch = jest.fn().mockRejectedValue(new Error('Fetch error'))
    const mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    await run(...runArgs)

    expect(core.error).toHaveBeenCalledWith(new Error('Fetch error'))
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})
