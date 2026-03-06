import {
  camelCase,
  createNamingConventionTransform,
  createRenameTransform,
  defineConfig,
} from '@graphql-mesh/compose-cli'
import { loadOpenAPISubgraph } from '@omnigraph/openapi'

export const composeConfig = defineConfig({
  subgraphs: [
    {
      sourceHandler: loadOpenAPISubgraph('42API', {
        endpoint: 'http://api.intra.42.fr/v2/',
        source: './openapi.yml',
      }),
      transforms: [
        createRenameTransform({
          argRenamer(opts) {
            if (opts.argName.startsWith('filter_LEFT_SQUARE_BRACE_')) {
              return opts.argName
                .replace('filter_LEFT_SQUARE_BRACE_', '')
                .replace('_RIGHT_SQUARE_BRACE_', '')
            }
            if (opts.argName.startsWith('range_LEFT_SQUARE_BRACE_')) {
              const arg = opts.argName
                .replace('range_LEFT_SQUARE_BRACE_', '')
                .replace('_RIGHT_SQUARE_BRACE_', '')
              return 'range' + arg.charAt(0).toUpperCase() + arg.slice(1)
            }
            if (opts.argName.startsWith('page_LEFT_SQUARE_BRACE_')) {
              const arg = opts.argName
                .replace('page_LEFT_SQUARE_BRACE_', '')
                .replace('_RIGHT_SQUARE_BRACE_', '')
              return 'page' + arg.charAt(0).toUpperCase() + arg.slice(1)
            }
            return ''
          },
        }),
        createNamingConventionTransform({
          enumValues: (name) => {
            // ALL_CAPS値はそのまま保持 (HttpMethod: GET, POST等)
            if (/^[A-Z]+$/.test(name)) {
              return name
            }
            // 降順ソート値: _project_id -> descProjectId
            if (name.startsWith('_')) {
              return camelCase(`desc_${name.slice(1)}`)
            }
            // 昇順ソート値: project_id -> projectId
            return camelCase(name)
          },
          fieldArgumentNames: 'camelCase',
          fieldNames: 'camelCase',
          typeNames: 'pascalCase',
        }),
      ],
    },
  ],
})
