export const APP_CONFIG = {
  supabaseUrl: 'https://olqhngiyebbjuhgsqrkk.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWhuZ2l5ZWJianVoZ3NxcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNDg2ODUsImV4cCI6MjA5OTgyNDY4NX0.vhPykFFjmYyr9rGOmoVYNx5CNKEnz-qRCMkvidQdcV8',
  apiUrl: typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/api')
    : (process.env['API_URL'] || 'http://localhost:3000')
};
