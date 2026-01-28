module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Return the modified webpack config
      return webpackConfig;
    },
  },
  devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {
    // Override the deprecated middleware setup methods
    // Remove deprecated onBeforeSetupMiddleware and onAfterSetupMiddleware
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;

    // Use the new setupMiddlewares function instead
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // Execute any before setup middleware logic here if needed
      // This is where onBeforeSetupMiddleware functionality goes

      // Add custom middlewares before the default ones if needed
      // middlewares.unshift({
      //   name: 'custom-before-middleware',
      //   path: '/custom-path',
      //   middleware: (req, res, next) => {
      //     // Custom logic
      //     next();
      //   },
      // });

      // The default middlewares array contains all the standard CRA middlewares
      // They are already set up by react-scripts/webpack

      // Add custom middlewares after the default ones if needed
      // This is where onAfterSetupMiddleware functionality goes
      // middlewares.push({
      //   name: 'custom-after-middleware',
      //   path: '/custom-path',
      //   middleware: (req, res, next) => {
      //     // Custom logic
      //     next();
      //   },
      // });

      return middlewares;
    };

    return devServerConfig;
  },
};
