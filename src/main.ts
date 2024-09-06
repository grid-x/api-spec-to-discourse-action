import * as core from '@actions/core'
import { openAsBlob, statSync, readFileSync } from 'node:fs';
import { readFile } from "node:fs/promises";
import { lookup } from "mime-types";
import Axios from "axios";
import FormData from "form-data";
import fs from "fs";

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

    const uploadUrl = `https://${discourseUrl}/uploads.json`
    const postUrl = `https://${discourseUrl}/posts/${discoursePostId}.json`

    const upload = async (specPath: string): Promise<string | void> => {
      // ref: https://docs.discourse.org/#tag/Uploads/operation/createUpload
      const payload = new FormData()

      const http = Axios.create({
        baseURL: `https://${discourseUrl}`,
        headers: {
          "Api-Key": discourseApiKey,
          "Api-Username": discourseUser,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      http.interceptors.request.use((config) => {
        if (config.data instanceof FormData) {
          Object.assign(config.headers, config.data.getHeaders());
        }
        return config;
      });
      const file = fs.readFileSync(specPath);
      const form = new FormData();
      form.append("files[]", file, {
        filename: specPath,
      });

      return http
        .post("/uploads.json", form, {
          params: {
            type: "composer",
            synchronous: true,
          },
        })
        .then(({ data }) => {
          core.debug(JSON.stringify(data, null, 2));
          return data.url;
        })
        .catch((e) => {
          console.error(
            "Error uploading file to Discourse",
            JSON.stringify(e, null, 2)
          );
          throw e;
        });
    }

    const updatePost = async (specUrl: string): Promise<void> => {
      // ref: https://docs.discourse.org/#tag/Posts/operation/updatePost
      core.info(`Updating ${postUrl}`)

      const payload = {
        post: {
          raw: postBody(specUrl, commit),
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
          core.info("... updated")
          core.debug(res.statusText)
        })
        .catch(err => { core.error(err); process.exit(1) })
    }

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Uploading ${specFile} to post #${discoursePostId}`)

    // Log the current timestamp, wait, then log the new timestamp
    await upload(specFile)
      .then(async specPath =>
        // we can coerce string | void into string as void happens only with client side aborted requests
        updatePost(specPath as string)
      )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

const str2blob = (txt: string) => new Blob([txt]);

const postBody = (specUrl: string, commit: string): string => `\`\`\`apidoc
${specUrl}
\`\`\`

*last updated*: ${new Date().toISOString()} (${commit.trim()})
`

