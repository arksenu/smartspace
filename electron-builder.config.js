module.exports = {
  appId: 'com.smartspace.app',
  productName: 'SmartSpace',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: [
    'electron/**/*',
    'package.json',
  ],
  // Configure ASAR options - unpack files that need to be executed
  asar: {
    smartUnpack: true,
  },
  asarUnpack: [
    'electron/**/*',
  ],
  // Copy the standalone Next.js build as extra resources (outside ASAR)
  extraResources: [
    {
      from: '.next/standalone',
      to: 'standalone',
      filter: ['**/*'],
    },
    {
      from: '.next/static',
      to: 'standalone/.next/static',
      filter: ['**/*'],
    },
  ],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'build/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.ico',
    publisherName: 'SmartSpace',
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'deb',
        arch: ['x64'],
      },
    ],
    category: 'Office',
    icon: 'build/icon.png',
    desktop: {
      Name: 'SmartSpace',
      Comment: 'AI Knowledge Workspace',
      Categories: 'Office;',
    },
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  publish: {
    provider: 'github',
    owner: 'your-username', // Update this
    repo: 'smartspace', // Update this
  },
  protocols: [
    {
      name: 'SmartSpace Protocol',
      schemes: ['smartspace'],
    },
  ],
};
