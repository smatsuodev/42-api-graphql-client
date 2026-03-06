import {
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
          fieldArgumentNames: 'camelCase',
          fieldNames: 'camelCase',
          typeNames: 'pascalCase',
        }),
      ],
    },
  ],
})
