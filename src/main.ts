import * as core from '@actions/core'
import Axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

type DiscourseUploadResult = {
  url: string
  short_url: string
  short_path: string
  original_filename: string
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(
  discourseUrl: string,
  discoursePostId: string,
  discourseApiKey: string,
  discourseUser: string,
  commit: string,
  specFile: string
): Promise<void> {
  try {
    const discourseHeaders = {
      'Api-Key': discourseApiKey,
      'Api-Username': discourseUser
    }
    const postUrl = `https://${discourseUrl}/posts/${discoursePostId}.json`

    const upload = async (specPath: string): Promise<DiscourseUploadResult | void> => {
      // ref: https://docs.discourse.org/#tag/Uploads/operation/createUpload
      const http = Axios.create({
        baseURL: `https://${discourseUrl}`,
        headers: {
          'Api-Key': discourseApiKey,
          'Api-Username': discourseUser,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      })
      http.interceptors.request.use(config => {
        if (config.data instanceof FormData) {
          Object.assign(config.headers, config.data.getHeaders())
        }
        return config
      })
      const file = fs.readFileSync(specPath)
      const form = new FormData()
      form.append('files[]', file, {
        filename: specPath
      })

      return http
        .post('/uploads.json', form, {
          params: {
            type: 'composer',
            synchronous: true
          }
        })
        .then(({ data }) => {
          core.debug(JSON.stringify(data, null, 2))
          return {
            url: data.url,
            short_url: data.short_url,
            short_path: data.short_path,
            original_filename: data.original_filename,
          }
        })
        .catch(e => {
          console.error(
            'Error uploading file to Discourse',
            JSON.stringify(e, null, 2)
          )
          throw e
        })
    }

    const updatePost = async (uploadResult: DiscourseUploadResult): Promise<void> => {
      // ref: https://docs.discourse.org/#tag/Posts/operation/updatePost
      core.info(`Updating ${postUrl}`)

      const payload = {
        post: {
          raw: postBody(uploadResult, commit),
          edit_reason: `Uploaded spec at ${commit}`
        }
      }
      return fetch(postUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...discourseHeaders
        },
        body: JSON.stringify(payload)
      })
        .then(res => {
          core.info('... updated')
          core.debug(res.statusText)
        })
        .catch(err => {
          core.error(err)
          process.exit(1)
        })
    }

    const postBody = (uploadResult: DiscourseUploadResult, commit: string): string => `\`\`\`apidoc
https://${discourseUrl}/${uploadResult.short_path}
\`\`\`

[${uploadResult.original_filename}|attachment](${uploadResult.short_url})

*last updated*: ${new Date().toISOString()} (sha ${commit.trim()})
`

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Uploading ${specFile} to post #${discoursePostId}`)

    // Log the current timestamp, wait, then log the new timestamp
    await upload(specFile)
      .then(async uploadResult => {
        if (!uploadResult) {
          throw new Error("Upload failed. Aborting post update.")
        }
        return updatePost(uploadResult)
      }
      )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
