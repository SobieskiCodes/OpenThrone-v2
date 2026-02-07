const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // Bundle workspace packages, keep everything else external
        allowlist: [/^@openthrone\//],
        // Include both root and local node_modules for pnpm
        additionalModuleDirs: [
          path.resolve(__dirname, '../../node_modules'),
        ],
      }),
    ],
    module: {
      ...options.module,
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              allowTsInNodeModules: true,
            },
          },
          include: [
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname, '../../packages'),
          ],
        },
      ],
    },
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.js', '.json'],
    },
  };
};
