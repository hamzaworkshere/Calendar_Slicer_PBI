'use strict';
const path = require('path');

// v4 import style:
const { PowerBICustomVisualsWebpackPlugin } = require('powerbi-visuals-webpack-plugin');

const plugin = new PowerBICustomVisualsWebpackPlugin({
  visual: {
    name: 'calendarSlicer',
    displayName: 'Calendar Slicer',
    guid: 'CalendarSlicerHamzaMemon4F3F6C88',
    class: 'Visual',
    apiVersion: '5.2.0',
    icon: 'assets/icon.png',       // our icon file
    capabilities: 'capabilities.json'
  }
});

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  entry: {
    visual: './src/visual.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'visual.js'
  },
  module: {
    rules: [
      { test: /\.ts?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.less$/, use: ['style-loader', 'css-loader', 'less-loader'] },
      { test: /\.png$/, type: 'asset/resource' }
    ]
  },
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [plugin]
};
