import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateApi } from 'swagger-typescript-api'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultWeb = path.resolve(here, '../../WMess.Web/WMess.Web.json')
const defaultApi = path.resolve(here, '../../WMess.Api/WMess.Api.json')

let input = process.env.OPENAPI_SPEC
if (!input) {
  input = fs.existsSync(defaultWeb) ? defaultWeb : defaultApi
}

await generateApi({
  input,
  output: path.resolve('./src/api/generated'),
  fileName: 'Api.ts',
  httpClientType: 'axios',
  modular: true,
  moduleNameFirstTag: true,
  cleanOutput: true,
})
