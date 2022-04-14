# docker, rails, mysql, skip-javascript, skip-turbolinks, webpackの環境構築


# rails

## 任意のディレクトリ内で…
```
rails-demo $ touch {Dockerfile,docker-compose.yml,Gemfile,Gemfile.lock,entrypoint.sh}
```

## docker-compose.yml
```
version: '3'
services:
  demo_db:
    container_name: demo_db
    image: mysql:5.7
    environment:
      MYSQL_DATABASE: root
      MYSQL_ROOT_PASSWORD: password
    ports:
      - "13397:3306"
    volumes:
      - ./tmp/db:/var/lib/mysql

  demo:
    container_name: demo
    build: .
    command: bash -c "rm -f tmp/pids/server.pid && bundle exec rails s -p 3000 -b '0.0.0.0'"
    volumes:
      - .:/demo
    ports:
      - "3000:3000"
    depends_on:
      - demo_db
```

## Dockerfile
```
FROM ruby:2.7.5

# yarnパッケージ管理ツールをインストール
RUN apt-get update && apt-get install -y curl apt-transport-https wget && \
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
apt-get update && apt-get install -y yarn

RUN apt-get update -qq && apt-get install -y nodejs yarn
RUN mkdir /demo
WORKDIR /demo
COPY Gemfile /demo/Gemfile
COPY Gemfile.lock /demo/Gemfile.lock
RUN bundle install
COPY . /demo

RUN yarn install --check-files

# コンテナ起動時に実行させるスクリプトを追加
COPY entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
EXPOSE 3000
```

## entrypoint.sh
```
#!/bin/bash
set -e

rm -f /demo/tmp/pids/server.pid

exec "$@"
```

## Gemfile
```
source 'https://rubygems.org'
gem 'rails', "~> 7.0.2"
```

## 任意のディレクトリ内で…
```
rails-demo $ docker-compose build --no-cache
＜略＞
rails-demo $ docker-compose run demo rails new . --no-deps --database=mysql --skip-javascript --skip-turbolinks
＜略＞
```


## config/database.yml
```
default: &default
  adapter: mysql2
  encoding: utf8mb4
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  username: root
  password:
  host: localhost

development:
  <<: *default
  database: demo_development
  host: demo_db
  username: root
  password: password

test:
  <<: *default
  database: demo_test
  host: demo_db
  username: root
  password: password
```

## 任意のディレクトリ内で…
```
rails-demo $ docker-compose run demo rails db:create
[+] Running 1/0
 ⠿ Container demo_db  Running                                                                                                                                                   0.0s
Could not find public_suffix-4.0.7 in any of the sources
Run `bundle install` to install missing gems.
rails-demo $ docker-compose build --no-cache
＜略＞
rails-demo $ docker-compose run demo rails db:create
[+] Running 1/0
 ⠿ Container demo_db  Running
Created database 'demo_development'
Created database 'demo_test'
```

## 任意のディレクトリ内で…挙動確認
```
rails-demo $ docker-compose up
```

# webpack

## yarnでいろいろ
```
rails-demo $ docker-compose run demo yarn add webpack webpack-cli webpack-remove-empty-scripts
rails-demo $ docker-compose run demo yarn add @babel/cli @babel/core @babel/polyfill @babel/preset-env babel-loader
rails-demo $ docker-compose run demo yarn add autoprefixer core-js css-loader file-loader mini-css-extract-plugin postcss postcss-loader sass sass-loader
```

## asset まわり
```
app/assets/_dev/js
app/assets/_dev/style
app/assets/builds
```

## webpack.config.js
```
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
```

## manifest.js
```
//= link_tree ../images
//= link_tree ../builds
```

## bin/dev
```
#!/usr/bin/env bash
if ! command -v foreman &> /dev/null
then
  echo "Installing foreman..."
  gem install foreman
fi
foreman start -f Procfile.dev "$@"
```

## Procfile.dev
```
web: rm -f tmp/pids/server.pid && bundle exec rails s -p 3000 -b '0.0.0.0'
js: yarn dev
```

## docker-compose.yml
```
- command: bash -c "rm -f tmp/pids/server.pid && bundle exec rails s -p 3000 -b '0.0.0.0'"
+ command: bash -c "./bin/dev"
```

## Gemfile
```
gem "sassc-rails"
gem 'jsbundling-rails'
```

## 任意のディレクトリ内で…
```
rails-demo $ docker-compose build --no-cache
＜結構待つ…＞
```

## 挙動確認1
```
rails-demo $ docker-compose up
```

## routes.rb
```
Rails.application.routes.draw do
  root "top#index"
end
```

## app/views/top/index.html.erb
```
<div>
app/views/top/index.html.erb
</div>
```

## app/controllers/top_controller.rb
```
class TopController < ApplicationController
  def index
  end
end
```
## package.json 末尾に追加
```
  + "scripts": {
  +   "dev": "webpack --mode development --watch",
  +   "build": "webpack --mode production"
  + }
}
```


## 任意のディレクトリ内で…
```
rails-demo $ docker-compose build --no-cache
＜結構待つ…＞
```

## 挙動確認2
```
rails-demo $ docker-compose up
＜略＞
demo     | bash: ./bin/dev: /usr/bin/env: bad interpreter: Permission denied
```

## 権限がおかしいので、
```
$ ls bin/dev
-rw-r--r--
$ chmod -R 755 bin/dev
$ ls bin/dev
-rwxr-xr-x
$ docker-compose build
＜略＞
$ docker-compose up
```

# 参考
https://tmasuyama1114.com/docker-compose-rails6-mysql-development/
https://qiita.com/geek_shanshan/items/8f348734d95d9ece9576