process.env.NODE_ENV = 'test';

const originalConsoleLog = console.log;
console.log = (...args) => {
  if (!args[0]?.includes('Server is running') &&
      !args[0]?.includes('JWT_SECRET установлен')) {
    originalConsoleLog(...args);
  }
};
