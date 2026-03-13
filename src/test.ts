import { run } from './main'
import { execSync } from 'node:child_process'

/*
export DISCOURSE_URL=community.developer.gridx.de
export DISCOURSE_POST_ID=<n>
export DISCOURSE_API_KEY=...
export DISCOURSE_USER=wwerner
export DISCOURSE_BODY_TEMPLATE="API Documentation/Specification \`{ORIGINAL_FILENAME}\`

\`\`\`apidoc
https://{DISCOURSE_URL}/{UPLOAD_PATH}
\`\`\`
"
*/

const discourseUrl: string = process.env.DISCOURSE_URL ?? ''
const discoursePostId: string = process.env.DISCOURSE_POST_ID ?? ''
const discourseApiKey: string = process.env.DISCOURSE_API_KEY ?? ''
const discourseUser: string = process.env.DISCOURSE_USER ?? ''
const discourseBodyTemplate: string = process.env.DISCOURSE_BODY_TEMPLATE ?? ''
const commit: string = execSync('git rev-parse --short HEAD').toString()

const specFile = './petstore.yaml'

run(
  discourseUrl,
  discoursePostId,
  discourseApiKey,
  discourseUser,
  commit,
  specFile,
  discourseBodyTemplate
)
