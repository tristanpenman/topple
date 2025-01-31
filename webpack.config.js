const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const distFolder = "./dist";

const plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify(nodeEnv)
    }
  }),
  new CleanWebpackPlugin([distFolder]),
  new HtmlWebpackPlugin({
    template: 'index.html'
  }),
  new CopyWebpackPlugin([
    { from: 'assets', to: 'assets' },
  ]),
  new webpack.LoaderOptionsPlugin({
    options: {
      tslint: {
        emitErrors: true,
        failOnHint: true
      }
    }
  })
];

var config = {
  devtool: isProd ? 'hidden-source-map' : 'source-map',
  context: path.resolve('./src'),
  entry: {
    app: './index.ts'
  },
  externals: {
    earcut: true,
    oimo: true
  },
  output: {
    path: path.join(__dirname, distFolder),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.tsx?$/,
        exclude: [/\/node_modules\//],
        use: ['ts-loader', 'source-map-loader']
      },
        {
          test: /\.(glsl|vert|frag)$/, loader: "shader-loader"
        },

        !isProd
        ? {
            test: /\.(js|ts)$/,
            loader: 'istanbul-instrumenter-loader',
            exclude: [/\/node_modules\//],
            query: {
              esModules: true
            }
          }
        : null,
      { test: /\.html$/, loader: 'html-loader' },
      { test: /\.css$/, loaders: ['style-loader', 'css-loader'] }
    ].filter(Boolean)
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: plugins,
  devServer: {
    contentBase: path.join(__dirname, 'dist/'),
    compress: true,
    disableHostCheck: true,
    port: 3000,
    hot: true
  }
};

module.exports = config;
