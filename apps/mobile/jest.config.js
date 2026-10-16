module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@sovereign-apps/react-native-app/example$':
      '<rootDir>/__tests__/PairingExampleMock.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*(?:react-native|@react-native|react-native-camera-kit|react-native-safe-area-context))',
  ],
};
