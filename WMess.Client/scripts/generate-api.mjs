import path from 'node:path'
import { generateApi } from 'swagger-typescript-api'

await generateApi({
  input: path.resolve('../WMess.Web/WMess.Web.json'),
  output: path.resolve('./src/api/generated'),
  fileName: 'Api.ts',
  httpClientType: 'axios',
  modular: true,
  moduleNameFirstTag: true,
  cleanOutput: true,
})
