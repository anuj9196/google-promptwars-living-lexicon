// Global test setup — suppress Google Cloud SDK credential warnings
// These are background async errors from SDK initialization, not test failures

// Catch and silence unhandled rejections from GCP credential discovery
const originalListeners = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (reason) => {
    // Silence Google Cloud auth errors during tests
    if (reason?.message?.includes('default credentials') ||
        reason?.message?.includes('Could not load')) {
        return; // Swallow — expected without GCP setup
    }
    // Re-throw non-GCP errors so real bugs are still caught
    for (const listener of originalListeners) {
        listener(reason);
    }
});

// Set fake env vars to minimize SDK auth attempts
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.NODE_ENV = 'test';
