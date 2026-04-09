// =====================================================
// CENTRALIZED CONFIGURATION FILE
// Edit this file and run: node config.js
// to update all deployment files automatically
// =====================================================

const fs = require('fs');
const path = require('path');

// ===========================================
// EDIT THESE VALUES ONLY
// ===========================================
const CONFIG = {
  // Your Vercel app URL (frontend)
  VERCEL_URL: 'https://xo-project.vercel.app',

  // Your Render server URL (backend) - without port if using standard HTTPS
  RENDER_URL: 'https://xo-project.onrender.com',

  // Server port (usually 3001 for Render)
  PORT: 3001,

  // Environment
  NODE_ENV: 'production',
};

// ===========================================
// AUTO-UPDATE ALL CONFIG FILES
// ===========================================
function updateConfigFiles() {
  const rootDir = __dirname;

  // 1. Update render.yaml
  const renderYamlPath = path.join(rootDir, 'render.yaml');
  if (fs.existsSync(renderYamlPath)) {
    let renderContent = fs.readFileSync(renderYamlPath, 'utf8');

    // Replace CLIENT_URL
    renderContent = renderContent.replace(
      /value: https:\/\/.*\.vercel\.app/,
      `value: ${CONFIG.VERCEL_URL}`
    );

    fs.writeFileSync(renderYamlPath, renderContent);
    console.log('✅ Updated render.yaml');
  }

  // 2. Update client/next.config.js
  const nextConfigPath = path.join(rootDir, 'client', 'next.config.js');
  if (fs.existsSync(nextConfigPath)) {
    let nextContent = fs.readFileSync(nextConfigPath, 'utf8');

    // Replace NEXT_PUBLIC_SERVER_URL
    nextContent = nextContent.replace(
      /NEXT_PUBLIC_SERVER_URL:.*\|\| '.*'/,
      `NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || '${CONFIG.RENDER_URL}'`
    );

    fs.writeFileSync(nextConfigPath, nextContent);
    console.log('✅ Updated client/next.config.js');
  }

  // 3. Update server .env.example (create .env for local use)
  const serverEnvPath = path.join(rootDir, 'server', '.env');
  const serverEnvExamplePath = path.join(rootDir, 'server', '.env.example');

  const serverEnvContent = `# Server Environment Variables
PORT=${CONFIG.PORT}
NODE_ENV=${CONFIG.NODE_ENV}
CLIENT_URL=${CONFIG.VERCEL_URL}
`;

  fs.writeFileSync(serverEnvExamplePath, serverEnvContent);
  console.log('✅ Updated server/.env.example');

  // Create .env for local development (won't be committed due to .gitignore)
  try {
    fs.writeFileSync(serverEnvPath, serverEnvContent);
    console.log('✅ Created server/.env (for local development)');
  } catch (err) {
    console.log('ℹ️  Could not create server/.env (it is gitignored, which is correct)');
  }

  // 4. Update client/.env.local (for local development)
  const clientEnvPath = path.join(rootDir, 'client', '.env.local');
  const clientEnvContent = `# Client Environment Variables
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
`;

  try {
    fs.writeFileSync(clientEnvPath, clientEnvContent);
    console.log('✅ Created client/.env.local (for local development)');
  } catch (err) {
    console.log('ℹ️  Could not create client/.env.local');
  }

  console.log('\n🎉 All configuration files updated successfully!');
  console.log('\nCurrent configuration:');
  console.log(`  • Vercel URL: ${CONFIG.VERCEL_URL}`);
  console.log(`  • Render URL: ${CONFIG.RENDER_URL}`);
  console.log(`  • Port: ${CONFIG.PORT}`);
  console.log(`  • Environment: ${CONFIG.NODE_ENV}`);
}

// Run if this file is executed directly
if (require.main === module) {
  updateConfigFiles();
}

module.exports = { CONFIG, updateConfigFiles };
