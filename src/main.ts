import * as core from '@actions/core'
import { createReadStream } from 'fs'
import FormData from 'form-data' // not using node native FormData as it does not support ReadableStreams

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const discourseUrl: string = core.getInput('discourse_url')
    const discoursePostId: string = core.getInput('discourse_post_id')
    const commit: string = process.env.GITHUB_SHA ?? ''
    const discourseHeaders = {
      'Api-Key': core.getInput('discourse_api_key'),
      'Api-Username': core.getInput('discourse_user')
    }

    const specFile: string = core.getInput('spec_file')

    const uploadUrl = `https://${discourseUrl}/uploads.json`
    const postUrl = `https://${discourseUrl}/posts/${discoursePostId}.json`

    const upload = async (specPath: string): Promise<string | void> => {
      // ref: https://docs.discourse.org/#tag/Uploads/operation/createUpload
      const payload = new FormData()
      payload.append('synchronous', 'true')
      payload.append('type', 'composer')
      payload.append('file', createReadStream(specPath))

      return fetch(uploadUrl, {
        method: 'POST',
        // @ts-expect-error https://github.com/node-fetch/node-fetch/issues/1769
        duplex: 'half',
        headers: {
          ...payload.getHeaders(),
          ...discourseHeaders
        },
        body: stream(payload)
      }).then(async res => res.text())
    }

    const updatePost = async (specPath: string): Promise<Response> => {
      // ref: https://docs.discourse.org/#tag/Posts/operation/updatePost

      const payload = {
        post: {
          raw: postBody(`https://${discourseUrl}}/${specPath}`, commit),
          edit_reason: `Uploaded spec at ${commit}`
        }
      }
      return fetch(postUrl, {
        method: 'PUT',
        // @ts-expect-error https://github.com/node-fetch/node-fetch/issues/1769
        duplex: 'half',
        headers: {
          'Content-Type': 'application/json',
          ...discourseHeaders
        },
        body: JSON.stringify(payload)
      })
    }
    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Uploading ${specFile} to ${discoursePostId}`)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await upload(specFile)
      .then(async specPath =>
        // we can coerce string | vpid into string as void happens only with client side aborted requests
        updatePost(specPath as string)
      )
      .then(console.log)
    core.debug(new Date().toTimeString())

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

const stream = (form: FormData): ReadableStream =>
  new ReadableStream({
    async pull(controller) {
      return new Promise(function (resolve) {
        form.on('data', function (chunk) {
          controller.enqueue(chunk)
        })
        form.once('end', function () {
          resolve()
        })
        form.resume()
      })
    }
  })

const postBody = (specUrl: string, commit: string): string => `\`\`\`apidoc
${specUrl}
\`\`\`

*last updated*: ${Date.now()} (${commit})
`
