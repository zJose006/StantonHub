module.exports = {
  apps: [
    {
      name: 'stanton-hub',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '4173'
      }
    }
  ]
};
