module.exports = {
  apps: [
    {
      name: "ponagar-api-2996",
      script: "dist/server.js",
      cwd: "/var/www/gamethapba",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 2996
      }
    },
    {
      name: "ponagar-api-2997",
      script: "dist/server.js",
      cwd: "/var/www/gamethapba",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 2997
      }
    },
    {
      name: "ponagar-api-2998",
      script: "dist/server.js",
      cwd: "/var/www/gamethapba",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 2998
      }
    }
  ]
};
