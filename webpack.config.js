const path    = require("path");
const webpack = require("webpack");
const glob = require("glob"); //globで、ワイルドカードを使ったファイル名特定を使う。
const MiniCssExtractPlugin = require('mini-css-extract-plugin'); // jsがcssを読み込んでいる場合、cssを切り出して出力
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts'); // 空のjsファイルを消す

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
// const enabledSourceMap = mode === "development";
const enabledSourceMap = false;
const devPath = './app/assets/_dev/';

// -----------------------------
// entryのobject生成
// -----------------------------
const directory  = {
  "js": ["js"],
  "style": ["scss","css"],
};
const entries = {};
for (let key in directory) {
  directory[key].forEach(extension =>{
    glob.sync(`**/*.${extension}`,{
      cwd: `${devPath}${key}/`,
      ignore: '**/_*',
    }).map(fileName => {
      const ext = new RegExp( `.${extension}$`);
      const fileNameExceptExt = fileName.replace(ext, '');
      const filePath = path.resolve(`${devPath}${key}/`, fileName);
      if (entries[fileNameExceptExt]) {
        entries[fileNameExceptExt].push(filePath);
      } else {
        entries[fileNameExceptExt] = [filePath];
      }
    });
  });
}

module.exports = {
  mode: mode,
  devtool: false,
  entry: entries,
  output: {
    filename: "[name].js",
    sourceMapFilename: "[name].js.map",
    path: path.resolve(__dirname, "app/assets/builds"),
  },
  plugins: [
    new RemoveEmptyScriptsPlugin(),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    }),
    new webpack.SourceMapDevToolPlugin({}),
    new MiniCssExtractPlugin({}),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                useBuiltIns: 'usage',
                'corejs': 3 // 参考: https://qiita.com/riversun/items/63c5f08c8da604c5ec1a
              }
            ]
          ]
        }
      },
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              url: false,
              sourceMap: enabledSourceMap,
              importLoaders: 2,
            },
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: enabledSourceMap,
              postcssOptions: {
                plugins: [
                  require('autoprefixer')({
                    grid: true
                  }),
                ],
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: enabledSourceMap,
            },
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif|eot|woff2|woff|ttf|svg)$/i,
        use: 'file-loader'
      },
    ]
  },
  resolve: {
    extensions: [
      '.js',
      '.scss', '.css',
      '.jpg', '.png', '.gif',
      '.woff', '.woff2', '.svg', '.ttf', '.eot',
      ' '
    ],
  },
}