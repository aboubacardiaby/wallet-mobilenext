// @ts-check
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

const existingBlockList = config.resolver.blockList
  ? (Array.isArray(config.resolver.blockList)
      ? config.resolver.blockList
      : [config.resolver.blockList])
  : []

// Ignore transient Visual Studio solution cache folders so Metro does not try
// to watch paths that may be created/deleted while the dev server is running.
config.resolver.blockList = [
  /[\/\\]\.vs[\/\\]/,
  ...existingBlockList,
]

module.exports = config
